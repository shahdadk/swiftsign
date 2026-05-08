import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } })
  if (!endpoint || endpoint.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      eventType: true,
      eventId: true,
      statusCode: true,
      attempts: true,
      deliveredAt: true,
      lastError: true,
      createdAt: true,
      nextAttemptAt: true,
    },
  })

  return NextResponse.json({ deliveries })
}
