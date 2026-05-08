import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { retryDelivery } from '@/lib/webhooks'
import { MAX_ATTEMPTS } from '@/lib/webhook-retry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
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
