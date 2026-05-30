import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { sendNextSigner } from '@/lib/email'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { signLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { emit } from '@/lib/webhooks'
import { captureGeo } from '@/lib/geo'
import { isTokenExpired } from '@/lib/signing-token'
import type { Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient

const FieldValueSchema = z.object({
  fieldId: z.string().min(1),
  value: z.string(),
})

const ConsentSchema = z.object({
  accepted: z.literal(true),
  version: z.string().default('1.0'),
})

const SigningRequestSchema = z.object({
  fields: z.array(FieldValueSchema).min(1),
  consent: ConsentSchema,
})

// ---------- POST /api/sign/[token] ----------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const limit = await signLimiter.limit(token)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(limit) }
      )
    }

    const headersList = await headers()
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      'unknown'
    const userAgent = headersList.get('user-agent') ?? 'unknown'
    const geo = captureGeo(headersList)

    // 1. Look up recipient by signing token
    const recipient = await prisma.recipient.findUnique({
      where: { signingToken: token },
      include: {
        envelope: {
          include: {
            recipients: { orderBy: { routingOrder: 'asc' } },
            documents: { orderBy: { order: 'asc' } },
            user: true,
          },
        },
        fields: true,
      },
    })

    if (!recipient) {
      return NextResponse.json(
        { error: 'Invalid signing token' },
        { status: 404 }
      )
    }

    // 1b. Enforce single-use + expiry on the signing token.
    if (isTokenExpired(recipient.tokenExpiresAt)) {
      return NextResponse.json(
        { error: 'This signing link has expired' },
        { status: 410 }
      )
    }
    if (recipient.tokenUsedAt) {
      return NextResponse.json(
        { error: 'This signing link has already been used' },
        { status: 409 }
      )
    }

    // 2. Validate envelope is in SENT status
    if (recipient.envelope.status !== 'SENT') {
      return NextResponse.json(
        {
          error: `Envelope is ${recipient.envelope.status}, signing is not available`,
        },
        { status: 409 }
      )
    }

    // 3. Validate recipient hasn't already signed
    if (recipient.status === 'SIGNED') {
      return NextResponse.json(
        { error: 'You have already signed this document' },
        { status: 409 }
      )
    }

    // 3b. Consent must have been captured BEFORE signing (and before document
    // access — see /api/sign/[token]/consent). Reject if not consented.
    if (!recipient.consentedAt) {
      return NextResponse.json(
        { error: 'Consent to electronic signing is required before signing' },
        { status: 409 }
      )
    }

    // 4. Parse and validate request body
    const body = await request.json()
    const parsed = SigningRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { fields: fieldValues, consent } = parsed.data

    // 5. Validate that submitted fields belong to this recipient
    const recipientFieldIds = new Set(
      recipient.fields.map((f: typeof recipient.fields[number]) => f.id)
    )
    for (const fv of fieldValues) {
      if (!recipientFieldIds.has(fv.fieldId)) {
        return NextResponse.json(
          {
            error: `Field ${fv.fieldId} does not belong to this recipient`,
          },
          { status: 400 }
        )
      }
    }

    // Check all required fields are provided
    const requiredFieldIds = recipient.fields
      .filter((f: typeof recipient.fields[number]) => f.required)
      .map((f: typeof recipient.fields[number]) => f.id)
    const submittedFieldIds = new Set(fieldValues.map((fv) => fv.fieldId))
    const missingFields = requiredFieldIds.filter(
      (id: string) => !submittedFieldIds.has(id)
    )
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missingFields,
        },
        { status: 400 }
      )
    }

    const envelope = recipient.envelope

    // 6. Execute signing in a transaction with optimistic locking on recipient.status.
    // The CAS-style updateMany matches only if status is still PENDING/SENT/DELIVERED;
    // if a concurrent request already flipped status to SIGNED, count === 0 and we
    // abort cleanly with 409 instead of overwriting the prior signing.
    const txResult = await prisma.$transaction(async (tx: Tx) => {
      const cas = await tx.recipient.updateMany({
        where: {
          id: recipient.id,
          status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
        },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
          tokenUsedAt: new Date(),
        },
      })

      if (cas.count === 0) {
        return { won: false as const }
      }

      // Won the race — save fields, write audits. Consent was already captured
      // and logged before document access (see /api/sign/[token]/consent), so we
      // don't re-log it here. Pass `tx` so every audit row chains inside THIS
      // transaction (logAudit otherwise opens its own, which would nest).
      for (const fv of fieldValues) {
        await tx.field.update({
          where: { id: fv.fieldId },
          data: { value: fv.value },
        })

        await logAudit(
          envelope.id,
          'FIELD_COMPLETED',
          {
            actorName: recipient.name,
            actorEmail: recipient.email,
            ipAddress,
            userAgent,
            metadata: {
              fieldId: fv.fieldId,
              recipientId: recipient.id,
            },
          },
          tx
        )
      }

      await logAudit(
        envelope.id,
        'RECIPIENT_SIGNED',
        {
          actorName: recipient.name,
          actorEmail: recipient.email,
          ipAddress,
          userAgent,
          metadata: {
            recipientId: recipient.id,
            consentVersion: consent.version,
            country: geo.country,
            region: geo.region,
            city: geo.city,
          },
        },
        tx
      )

      return { won: true as const }
    })

    if (!txResult.won) {
      return NextResponse.json(
        { error: 'You have already signed this document' },
        { status: 409 }
      )
    }

    emit(envelope.userId, 'envelope.signed', {
      envelopeId: envelope.id,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
    })

    // Save signature adoptions for future reuse (for every signer, not just last)
    const fieldTypeMap = new Map(
      recipient.fields.map((f: typeof recipient.fields[number]) => [f.id, f.type])
    )
    // Collect values to persist
    const adoptionUpdate: Record<string, string> = {}
    for (const fv of fieldValues) {
      const fType = fieldTypeMap.get(fv.fieldId)
      if (!fv.value) continue
      if (fType === 'SIGNATURE') adoptionUpdate.signature = fv.value
      if (fType === 'INITIALS') adoptionUpdate.initials = fv.value
      if (fType === 'NAME') adoptionUpdate.fullName = fv.value
    }
    if (Object.keys(adoptionUpdate).length > 0) {
      try {
        await prisma.signatureAdoption.upsert({
          where: { email_name: { email: recipient.email, name: recipient.name } },
          update: { ...adoptionUpdate, updatedAt: new Date() },
          create: { email: recipient.email, name: recipient.name, ...adoptionUpdate },
        })
      } catch { /* non-critical */ }
    }

    // 7. Check if all signers are done
    // Re-fetch recipients to get updated statuses
    const allRecipients = await prisma.recipient.findMany({
      where: { envelopeId: envelope.id },
      orderBy: { routingOrder: 'asc' },
    })

    type RecipientRow = typeof allRecipients[number]

    const signers = allRecipients.filter(
      (r: RecipientRow) => r.role === 'SIGNER'
    )
    const allSigned = signers.every(
      (r: RecipientRow) => r.status === 'SIGNED'
    )

    if (allSigned) {
      // All signers done — seal the document, generate certificate, send emails.
      // If sealing fails, return a real error to the signer instead of falsely
      // marking the envelope COMPLETED. The signer's submission is already saved;
      // this just means we couldn't finalize, which is recoverable by retry.
      try {
        const { sealAndComplete } = await import('@/lib/seal-and-complete')
        await sealAndComplete(envelope.id)
      } catch (sealErr) {
        logger.error(sealErr, { op: 'sealAndComplete', envelopeId: envelope.id })
        return NextResponse.json(
          {
            error:
              "We saved your signature but couldn't finalize the document. Our team has been notified — please reach out to the sender if you don't see a completion email shortly.",
          },
          { status: 500 }
        )
      }

      emit(envelope.userId, 'envelope.completed', {
        envelopeId: envelope.id,
      })

      return NextResponse.json({
        status: 'completed',
        message: 'All signers have signed. Document sealed and sent.',
      })
    }

    // Not all done — flatten completed fields into PDF for next signer.
    // If flatten fails, do NOT email the next signer with an unflattened doc;
    // surface a real error.
    try {
      const { flattenForNextSigner } = await import('@/lib/flatten-between-signers')
      await flattenForNextSigner(envelope.id)
    } catch (flattenErr) {
      logger.error(flattenErr, { op: 'flattenForNextSigner', envelopeId: envelope.id })
      return NextResponse.json(
        {
          error:
            "We saved your signature but couldn't prepare the document for the next signer. Our team has been notified.",
        },
        { status: 500 }
      )
    }

    // Find and notify next routing order recipients
    const currentOrder = recipient.routingOrder
    const pendingSigners = signers.filter(
      (r: RecipientRow) =>
        r.status === 'PENDING' && r.routingOrder > currentOrder
    )

    if (pendingSigners.length > 0) {
      const nextOrder = Math.min(
        ...pendingSigners.map((r: RecipientRow) => r.routingOrder)
      )
      const nextBatch = pendingSigners.filter(
        (r: RecipientRow) => r.routingOrder === nextOrder
      )

      const baseUrl = env.NEXT_PUBLIC_APP_URL

      for (const next of nextBatch) {
        const signingUrl = `${baseUrl}/sign/${next.signingToken}`

        await sendNextSigner(
          next.email,
          next.name,
          envelope.user.name ?? 'User',
          envelope.subject,
          signingUrl
        )

        await prisma.recipient.update({
          where: { id: next.id },
          data: { status: 'SENT' },
        })

        await logAudit(envelope.id, 'EMAIL_SENT', {
          metadata: {
            recipientEmail: next.email,
            recipientName: next.name,
            trigger: 'next_signer',
          },
        })
      }
    }

    return NextResponse.json({
      status: 'signed',
      message: 'Your signature has been recorded.',
    })
  } catch (err) {
    logger.error(err, { route: 'POST /api/sign/[token]' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
