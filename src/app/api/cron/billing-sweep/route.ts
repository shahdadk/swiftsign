import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
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
