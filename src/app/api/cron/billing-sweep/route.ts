import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

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

    // (a) Downgrade users whose grace period has lapsed.
    const lapsed = await prisma.subscription.findMany({
      where: {
        status: { in: ['PAST_DUE', 'UNPAID'] },
        graceEndsAt: { not: null, lt: now },
      },
      select: { id: true, userId: true },
    })

    let downgraded = 0
    for (const sub of lapsed) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: 'FREE' },
      })
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { graceEndsAt: null },
      })
      downgraded++
    }

    // (b) Prune expired idempotency keys.
    const { count: pruned } = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    })

    return NextResponse.json({ downgraded, pruned })
  } catch (err) {
    logger.error(err, { route: 'GET /api/cron/billing-sweep' })
    return NextResponse.json(
      { error: 'Cron failure' },
      { status: 500 }
    )
  }
}
