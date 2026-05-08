import { NextResponse } from 'next/server'
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

const PatchBody = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(ALLOWED_EVENTS)).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const json = await request.json().catch(() => null)
  const parsed = PatchBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  try {
    const found = await prisma.webhookEndpoint.findUnique({ where: { id } })
    if (!found || found.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.webhookEndpoint.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error(err, { route: 'PATCH /api/account/webhooks/[id]', userId: user.id })
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const found = await prisma.webhookEndpoint.findUnique({ where: { id } })
    if (!found || found.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.webhookEndpoint.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error(err, { route: 'DELETE /api/account/webhooks/[id]', userId: user.id })
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
