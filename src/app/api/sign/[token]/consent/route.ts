import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recordConsent } from '@/lib/consent'
import { clientIp } from '@/lib/rate-limit'
import { isTokenExpired } from '@/lib/signing-token'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Records the ESIGN consumer-disclosure acceptance for a signer BEFORE the
// document is served. Idempotent: a second POST for an already-consented
// recipient returns 200 without writing a duplicate ConsentRecord.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const recipient = await prisma.recipient.findUnique({
      where: { signingToken: token },
      include: { envelope: true },
    })

    if (!recipient) {
      return NextResponse.json({ error: 'Invalid signing token' }, { status: 404 })
    }

    if (recipient.envelope.status !== 'SENT') {
      return NextResponse.json(
        { error: `Envelope is ${recipient.envelope.status}, signing is not available` },
        { status: 409 }
      )
    }

    if (recipient.status === 'SIGNED' || recipient.signedAt) {
      return NextResponse.json(
        { error: 'You have already signed this document' },
        { status: 409 }
      )
    }

    if (isTokenExpired(recipient.tokenExpiresAt)) {
      return NextResponse.json({ error: 'link expired' }, { status: 410 })
    }

    // Idempotent: already consented, nothing more to record.
    if (recipient.consentedAt) {
      return NextResponse.json({ ok: true })
    }

    await recordConsent({
      recipientId: recipient.id,
      envelopeId: recipient.envelopeId,
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error(err, { route: 'POST /api/sign/[token]/consent' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
