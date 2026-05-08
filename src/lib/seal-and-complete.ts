import { prisma } from './db'
import { downloadPdf, uploadPdf } from './storage'
import { sendCompleted } from './email'
import { logAudit } from './audit'
import { sealDocument, type SealField } from './seal'
import { generateCertificate, type CertificateData } from './certificate'
import { env } from './env'
import { logger } from './logger'

/**
 * Called when the last signer completes. Seals all documents, generates the
 * Certificate of Completion, updates the DB, and sends completion emails.
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

  const documentHashes: Record<string, string> = {}

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

    // c. Seal the document
    const { sealedPdf, documentHash } = await sealDocument(
      originalPdf,
      sealFields
    )

    // d. Upload sealed PDF to R2
    const sealedKey = `sealed/${envelopeId}/${doc.name}`
    await uploadPdf(sealedKey, sealedPdf)

    // e. Update document record
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        signedKey: sealedKey,
        documentHash,
      },
    })

    documentHashes[doc.name] = documentHash
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

  const certData: CertificateData = {
    envelopeId: envelope.id,
    subject: envelope.subject,
    documentHash: primaryHash,
    senderName: envelope.user.name ?? 'Unknown',
    senderEmail: envelope.user.email,
    completedAt: new Date(),
    signers,
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

  // 7. Send completion emails to all recipients + sender
  const baseUrl = env.NEXT_PUBLIC_APP_URL

  // Send to each recipient (signers + CC)
  for (const recipient of envelope.recipients) {
    try {
      const downloadUrl = `${baseUrl}/api/envelopes/${envelopeId}/download?token=${recipient.signingToken}`

      await sendCompleted(
        recipient.email,
        recipient.name,
        envelope.subject,
        downloadUrl
      )

      await logAudit(envelopeId, 'EMAIL_SENT', {
        metadata: {
          type: 'completion',
          recipientEmail: recipient.email,
          recipientName: recipient.name,
        },
      })
    } catch (err) {
      logger.error(err, {
        op: 'sendCompleted',
        recipient: recipient.email,
      })
    }
  }

  // Send to the sender (envelope owner)
  try {
    // Sender downloads via API key, so give them a link without token
    const senderDownloadUrl = `${baseUrl}/api/envelopes/${envelopeId}/download`
    await sendCompleted(
      envelope.user.email,
      envelope.user.name ?? 'User',
      envelope.subject,
      senderDownloadUrl
    )
  } catch (err) {
    logger.error(err, {
      op: 'sendCompleted-sender',
      sender: envelope.user.email,
    })
  }
}
