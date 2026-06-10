import crypto from 'crypto'
import { prisma } from './db'
import { downloadPdf, uploadPdf, getSignedUrl } from './storage'
import { sendCompleted } from './email'
import { logAudit } from './audit'
import { sealDocument, type SealField } from './seal'
import { generateCertificate, type CertificateData } from './certificate'
import { getAuditTrail, verifyChain } from '@/lib/audit-verify'
import { env } from './env'
import { logger } from './logger'

/**
 * Called when the last signer completes. Seals all documents, generates the
 * Certificate of Completion, updates the DB, and sends completion emails.
 *
 * Idempotent: if the envelope is already COMPLETED, returns immediately
 * without re-sealing or re-emailing. This prevents duplicate certificates
 * with diverging timestamps when the route handler retries.
 */
export async function sealAndComplete(envelopeId: string): Promise<void> {
  // 1. Load envelope with all related data
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      user: true,
      documents: {
        orderBy: { order: 'asc' },
        include: {
          fields: {
            include: { recipient: true },
          },
        },
      },
      recipients: {
        orderBy: { routingOrder: 'asc' },
      },
      auditLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Idempotency guard
  if (envelope.completedAt || envelope.status === 'COMPLETED') {
    logger.info('sealAndComplete called on already-completed envelope', {
      envelopeId,
      completedAt: envelope.completedAt,
    })
    return
  }

  const documentHashes: Record<string, string> = {}

  // Capture the digital-signature outcome across documents for the certificate:
  // prefer CAdES-T if any document achieved it, otherwise the last document's
  // profile. tsaTime tracks the timestamp of the CAdES-T (or last) signature.
  let certSignatureProfile = 'unsigned'
  let certTsaTime: Date | null = null

  // 2. Seal each document
  for (const doc of envelope.documents) {
    // a. Download the original PDF from R2
    const originalPdf = await downloadPdf(doc.originalKey)

    // b. Collect all field values for this document
    const sealFields: SealField[] = doc.fields
      .filter((f) => f.value !== null && f.value !== undefined)
      .map((f) => ({
        type: f.type,
        x: f.x,
        y: f.y,
        page: f.page - 1, // DB pages are 1-indexed, pdf-lib is 0-indexed
        value: f.value!,
        width: f.width,
        height: f.height,
      }))

    // c. Seal the document (bake the visual field values). Sandbox (test)
    //    envelopes get a "TEST — NOT LEGALLY BINDING" watermark on every page.
    const { sealedPdf: visualSealed } = await sealDocument(originalPdf, sealFields, {
      watermark: !envelope.livemode,
    })

    // c2. Apply the cryptographic PAdES/CAdES-T signature over the final bytes.
    //     The hash is computed over the SIGNED bytes so the public verifier
    //     matches the file recipients download. If signing fails we log and ship
    //     the visual-sealed bytes rather than hard-failing completion.
    let finalPdf: Buffer = visualSealed
    let signatureProfile = 'unsigned'
    let tsaTime: Date | null = null
    // Real PAdES signing applies to LIVE envelopes only; sandbox docs are
    // decorative (watermarked, unsigned).
    if (env.SIGNING_ENABLED && envelope.livemode) {
      try {
        const { signPdfBuffer } = await import('./signing/sign-pdf')
        const result = await signPdfBuffer(visualSealed, {
          reason: `Executed envelope ${envelopeId}`,
          name: 'SwiftSign Inc.',
          location: 'swiftsign.ca',
          contactInfo: envelope.user.email,
        })
        finalPdf = result.signed
        signatureProfile = result.profile
        tsaTime = result.tsaTime

        // Roll the per-document outcome up to the certificate-level vars.
        // CAdES-T wins and is sticky once achieved by any document.
        if (certSignatureProfile !== 'CAdES-T') {
          certSignatureProfile = signatureProfile
          certTsaTime = tsaTime
        }
      } catch (signErr) {
        logger.error(signErr, { op: 'signPdfBuffer', envelopeId, docName: doc.name })
      }
    }
    const documentHash = crypto.createHash('sha256').update(finalPdf).digest('hex')

    // d. Upload sealed PDF to R2
    const sealedKey = `sealed/${envelopeId}/${doc.name}`
    await uploadPdf(sealedKey, finalPdf)

    // e. Update document record
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        signedKey: sealedKey,
        documentHash,
      },
    })

    documentHashes[doc.name] = documentHash
    logger.info('document sealed', { envelopeId, docName: doc.name, signatureProfile, tsaTime })
  }

  // 3. Generate Certificate of Completion
  // Build signer data from audit logs and recipient records
  const signers = envelope.recipients
    .filter((r) => r.role === 'SIGNER' && r.status === 'SIGNED')
    .map((r) => {
      // Find the RECIPIENT_SIGNED audit log for this recipient to get IP
      const signAudit = envelope.auditLogs.find(
        (log) =>
          log.event === 'RECIPIENT_SIGNED' && log.actorEmail === r.email
      )

      // Try to determine signature method from field values
      const recipientFields = envelope.documents.flatMap((d) =>
        d.fields.filter(
          (f) => f.recipientId === r.id && f.type === 'SIGNATURE'
        )
      )

      let signatureMethod = 'typed'
      for (const field of recipientFields) {
        if (field.value?.startsWith('data:image/png')) {
          signatureMethod = 'drawn'
          break
        }
      }

      return {
        name: r.name,
        email: r.email,
        ipAddress: signAudit?.ipAddress ?? 'Unknown',
        signedAt: r.signedAt ?? new Date(),
        signatureMethod,
      }
    })

  // Use the first document's hash as the primary hash, or combine them
  const allHashes = Object.values(documentHashes)
  const primaryHash =
    allHashes.length === 1
      ? allHashes[0]
      : allHashes.join('; ')

  // Pull the verifiable audit trail + chain head for the certificate.
  const auditTrail = await getAuditTrail(envelopeId)
  const chain = await verifyChain(envelopeId)

  const certData: CertificateData = {
    envelopeId: envelope.id,
    subject: envelope.subject,
    documentHash: primaryHash,
    senderName: envelope.user.name ?? 'Unknown',
    senderEmail: envelope.user.email,
    completedAt: new Date(),
    signers,
    signatureProfile: certSignatureProfile,
    tsaTimestamp: certTsaTime,
    auditTrail: auditTrail.map((entry) => ({
      seq: entry.seq,
      event: entry.event,
      actorEmail: entry.actorEmail,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt,
    })),
    chainHead: chain.head,
  }

  const certificatePdf = await generateCertificate(certData)

  // 4. Upload certificate to R2
  const certKey = `certificates/${envelopeId}/certificate.pdf`
  await uploadPdf(certKey, certificatePdf)

  // 5. Update envelope status
  const completedAt = new Date()
  await prisma.envelope.update({
    where: { id: envelopeId },
    data: {
      status: 'COMPLETED',
      completedAt,
    },
  })

  // 6. Log audit event
  await logAudit(envelopeId, 'ENVELOPE_COMPLETED', {
    actorName: 'SwiftSign System',
    metadata: {
      documentHashes,
      certificateKey: certKey,
    },
  })

  // 7. Send completion emails to all recipients + sender. The SIGNED PDF is the
  // deliverable — attached inline when small, or as a 7-day signed download link
  // when the total would exceed Resend's ~40 MB payload cap (which otherwise
  // makes the whole email silently fail to send). The Certificate of Completion
  // is offered as a download link, not an inline attachment.
  const sealedAttachments: { filename: string; content: Buffer }[] = []
  for (const doc of envelope.documents) {
    if (!doc.signedKey) {
      logger.warn('completion email: document has no signedKey, skipping', {
        op: 'sendCompleted-loadAttachment',
        docName: doc.name,
      })
      continue
    }
    try {
      const buf = await downloadPdf(doc.signedKey)
      sealedAttachments.push({ filename: doc.name, content: buf })
    } catch (err) {
      logger.error(err, {
        op: 'sendCompleted-loadAttachment',
        docName: doc.name,
      })
    }
  }

  // Resend caps total payload at ~40 MB; base64 inflates ~33%, so guard at 25 MB
  // of raw bytes and fall back to signed download links over the threshold.
  const ATTACH_LIMIT = 25 * 1024 * 1024
  const totalBytes = sealedAttachments.reduce((n, a) => n + a.content.length, 0)
  const useLinks = totalBytes > ATTACH_LIMIT

  let downloadLinks: { filename: string; url: string }[] = []
  if (useLinks) {
    downloadLinks = await Promise.all(
      envelope.documents
        .filter((d) => d.signedKey)
        .map(async (d) => ({
          filename: d.name,
          url: await getSignedUrl(d.signedKey as string, 604800),
        }))
    )
  }

  // Certificate of Completion as a 7-day download link (not an inline attachment).
  let certificateUrl: string | null = null
  try {
    certificateUrl = await getSignedUrl(certKey, 604800)
  } catch (err) {
    logger.error(err, { op: 'sendCompleted-certificateUrl' })
  }

  const emailJobs = [
    ...envelope.recipients.map((recipient) => ({
      to: recipient.email,
      name: recipient.name,
      kind: 'recipient' as const,
    })),
    {
      to: envelope.user.email,
      name: envelope.user.name ?? 'User',
      kind: 'sender' as const,
    },
  ]

  await Promise.allSettled(
    emailJobs.map(async (job) => {
      try {
        await sendCompleted(
          job.to,
          job.name,
          envelope.livemode ? envelope.subject : `[TEST] ${envelope.subject}`,
          useLinks ? [] : sealedAttachments,
          { downloadLinks, certificateUrl }
        )
        await logAudit(envelopeId, 'EMAIL_SENT', {
          metadata: {
            type: 'completion',
            recipientEmail: job.to,
            recipientName: job.name,
            kind: job.kind,
          },
        })
      } catch (err) {
        logger.error(err, { op: 'sendCompleted', recipient: job.to, kind: job.kind })
        await logAudit(envelopeId, 'EMAIL_BOUNCED', {
          metadata: {
            type: 'completion',
            recipientEmail: job.to,
            kind: job.kind,
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch(() => {})
      }
    })
  )
}
