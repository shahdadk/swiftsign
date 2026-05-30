import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { retryDelivery } from '@/lib/webhooks'
import { MAX_ATTEMPTS } from '@/lib/webhook-retry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(auth: string | null): boolean {
  if (auth === null) return false
  const expected = `Bearer ${env.CRON_SECRET}`
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch; guard first so we reject without
  // throwing and without leaking length via timing.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!authorized(auth)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const due = await prisma.webhookDelivery.findMany({
      where: {
        deliveredAt: null,
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: now },
      },
      take: 100,
      orderBy: { nextAttemptAt: 'asc' },
    })

    let retried = 0
    for (const delivery of due) {
      await retryDelivery(delivery.id)
      retried++
    }

    return NextResponse.json({ retried })
  } catch (err) {
    logger.error(err, { route: 'GET /api/cron/webhook-retry' })
    return NextResponse.json(
      { error: 'Cron failure' },
      { status: 500 }
    )
  }
}
