import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { newSigningToken } from '@/lib/signing-token'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Embedded sessions are short-lived entry tickets for iframe signing. The
// recipient still signs with their own signingToken; this just mints a
// single-use /embed/<token> URL the integrator can drop into an iframe.
const EMBED_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ---------- POST /api/v1/envelopes/[id]/recipients/[recipientId]/embedded-url ----------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid Bearer API key' },
        { status: 401 }
      )
    }
    const { user } = auth

    const { id, recipientId } = await params

    // Envelope must belong to the authenticated user; otherwise 404 (don't
    // leak existence of other users' envelopes).
    const envelope = await prisma.envelope.findUnique({
      where: { id, userId: user.id },
      include: { recipients: true },
    })
    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.status !== 'SENT') {
      return NextResponse.json(
        {
          error: `Embedded signing is only available for SENT envelopes (status is ${envelope.status})`,
        },
        { status: 409 }
      )
    }

    const recipient = envelope.recipients.find((r) => r.id === recipientId)
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found on this envelope' },
        { status: 404 }
      )
    }

    if (recipient.role !== 'SIGNER') {
      return NextResponse.json(
        { error: 'Recipient is not a signer' },
        { status: 409 }
      )
    }

    if (recipient.status === 'SIGNED' || recipient.status === 'DECLINED') {
      return NextResponse.json(
        {
          error: `Recipient has already ${recipient.status === 'SIGNED' ? 'signed' : 'declined'}`,
        },
        { status: 409 }
      )
    }

    // Optional returnUrl must be https.
    let returnUrl: string | undefined
    const body = await request.json().catch(() => ({}))
    if (body?.returnUrl !== undefined && body.returnUrl !== null) {
      const raw = String(body.returnUrl)
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        return NextResponse.json(
          { error: 'returnUrl must be a valid URL' },
          { status: 400 }
        )
      }
      if (parsed.protocol !== 'https:') {
        return NextResponse.json(
          { error: 'returnUrl must use https' },
          { status: 400 }
        )
      }
      returnUrl = raw
    }

    const token = newSigningToken()
    const expiresAt = new Date(Date.now() + EMBED_TTL_MS)

    await prisma.embeddedSession.create({
      data: {
        recipientId: recipient.id,
        token,
        returnUrl,
        expiresAt,
      },
    })

    return NextResponse.json({
      url: `${env.NEXT_PUBLIC_APP_URL}/embed/${token}`,
      expiresAt,
    })
  } catch (err) {
    logger.error(err, {
      route: 'POST /api/v1/envelopes/[id]/recipients/[recipientId]/embedded-url',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
