import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_EVENTS = [
  'envelope.sent',
  'envelope.viewed',
  'envelope.signed',
  'envelope.completed',
  'envelope.declined',
  'envelope.voided',
] as const

const CreateBody = z.object({
  url: z.string().url(),
  events: z.array(z.enum(ALLOWED_EVENTS)).min(1),
  isActive: z.boolean().default(true),
})

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ endpoints })
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = CreateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: user.id,
        url: parsed.data.url,
        events: parsed.data.events,
        isActive: parsed.data.isActive,
        secret,
      },
    })
    return NextResponse.json({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      isActive: endpoint.isActive,
      // Return secret only on creation
      secret,
    })
  } catch (err) {
    logger.error(err, { route: 'POST /api/account/webhooks', userId: user.id })
    return NextResponse.json({ error: 'Failed to create endpoint' }, { status: 500 })
  }
}
