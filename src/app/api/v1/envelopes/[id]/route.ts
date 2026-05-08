import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendSigningRequest } from '@/lib/email'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { emit } from '@/lib/webhooks'
import type { Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient

// ---------- GET /api/v1/envelopes/[id] ----------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateApiKey(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid Bearer API key' },
        { status: 401 }
      )
    }

    const { id } = await params

    const envelope = await prisma.envelope.findUnique({
      where: { id, userId: user.id },
      include: {
        documents: { orderBy: { order: 'asc' } },
        recipients: {
          orderBy: { routingOrder: 'asc' },
          include: { fields: true },
        },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!envelope) {
      return NextResponse.json(
        { error: 'Envelope not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(envelope)
  } catch (err) {
    logger.error(err, { route: 'GET /api/v1/envelopes/[id]' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ---------- POST /api/v1/envelopes/[id] ----------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateApiKey(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid Bearer API key' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const action = body?.action

    if (action === 'send') {
      return await handleSend(id, user)
    }

    if (action === 'void') {
      return await handleVoid(id, user)
    }

    return NextResponse.json(
      { error: 'Invalid action — must be "send" or "void"' },
      { status: 400 }
    )
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/envelopes/[id]' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ---------- Action handlers ----------

interface ActionUser {
  id: string
  name: string | null
  email: string
}

async function handleSend(envelopeId: string, user: ActionUser) {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId, userId: user.id },
    include: {
      recipients: { orderBy: { routingOrder: 'asc' } },
    },
  })

  if (!envelope) {
    return NextResponse.json(
      { error: 'Envelope not found' },
      { status: 404 }
    )
  }

  if (envelope.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot send envelope in ${envelope.status} status` },
      { status: 409 }
    )
  }

  const signers = envelope.recipients.filter(
    (r: typeof envelope.recipients[number]) => r.role === 'SIGNER'
  )
  if (signers.length === 0) {
    return NextResponse.json(
      { error: 'Envelope has no signers' },
      { status: 400 }
    )
  }

  // Determine first routing order
  const firstOrder = Math.min(
    ...signers.map((r: typeof signers[number]) => r.routingOrder)
  )
  const firstBatch = signers.filter(
    (r: typeof signers[number]) => r.routingOrder === firstOrder
  )

  const baseUrl = env.NEXT_PUBLIC_APP_URL

  // Phase 1 (atomic): flip envelope to SENT, mark first-batch recipients SENT,
  // log ENVELOPE_SENT. NO email I/O — Resend's failure must not roll back the
  // envelope state.
  await prisma.$transaction(async (tx: Tx) => {
    await tx.envelope.update({
      where: { id: envelopeId },
      data: { status: 'SENT' },
    })

    for (const recipient of firstBatch) {
      await tx.recipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT' },
      })
    }

    await logAudit(envelopeId, 'ENVELOPE_SENT', {
      actorName: user.name ?? undefined,
      actorEmail: user.email,
      metadata: {
        recipientsSent: firstBatch.map(
          (r: typeof firstBatch[number]) => r.email
        ),
      },
    })
  })

  // Phase 2 (best-effort, post-commit): send emails. Failures are audit-logged
  // as EMAIL_BOUNCED but don't fail the request — envelope is already SENT.
  await Promise.allSettled(
    firstBatch.map(async (recipient) => {
      const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`
      try {
        await sendSigningRequest(
          recipient.email,
          recipient.name,
          user.name ?? 'User',
          envelope.subject,
          signingUrl
        )
        await logAudit(envelopeId, 'EMAIL_SENT', {
          actorName: user.name ?? undefined,
          actorEmail: user.email,
          metadata: {
            recipientEmail: recipient.email,
            recipientName: recipient.name,
          },
        })
      } catch (err) {
        logger.error(err, {
          op: 'sendSigningRequest',
          envelopeId,
          recipient: recipient.email,
        })
        await logAudit(envelopeId, 'EMAIL_BOUNCED', {
          actorEmail: user.email,
          metadata: {
            recipientEmail: recipient.email,
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch(() => {})
      }
    })
  )

  emit(user.id, 'envelope.sent', {
    envelopeId,
    subject: envelope.subject,
    recipients: firstBatch.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
    })),
  })

  return NextResponse.json({ status: 'sent', envelopeId })
}

async function handleVoid(envelopeId: string, user: ActionUser) {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId, userId: user.id },
  })

  if (!envelope) {
    return NextResponse.json(
      { error: 'Envelope not found' },
      { status: 404 }
    )
  }

  if (envelope.status === 'COMPLETED' || envelope.status === 'VOIDED') {
    return NextResponse.json(
      { error: `Cannot void envelope in ${envelope.status} status` },
      { status: 409 }
    )
  }

  await prisma.envelope.update({
    where: { id: envelopeId },
    data: { status: 'VOIDED' },
  })

  await logAudit(envelopeId, 'ENVELOPE_VOIDED', {
    actorName: user.name ?? undefined,
    actorEmail: user.email,
  })

  emit(user.id, 'envelope.voided', { envelopeId })

  return NextResponse.json({ status: 'voided', envelopeId })
}
