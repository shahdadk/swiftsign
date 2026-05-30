import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/dashboard/activity
 *
 * Returns the most recent AuditLog rows for the signed-in user's envelopes,
 * joined with the envelope's subject so the dashboard activity feed can
 * render human-readable lines without a second round-trip.
 *
 * Session-cookie auth only. The dashboard polls this every 5s; do NOT add
 * write side-effects here.
 *
 * Shape:
 *   { events: Array<{
 *       id: string,
 *       event: AuditEvent,
 *       envelopeId: string,
 *       envelopeSubject: string,
 *       actorName: string | null,
 *       actorEmail: string | null,
 *       createdAt: string,        // ISO
 *     }>
 *   }
 */

export const dynamic = 'force-dynamic'

const MAX_EVENTS = 25

export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const rows = await prisma.auditLog.findMany({
    where: { envelope: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    take: MAX_EVENTS,
    select: {
      id: true,
      event: true,
      envelopeId: true,
      actorName: true,
      actorEmail: true,
      createdAt: true,
      envelope: { select: { subject: true } },
    },
  })

  const events = rows.map((r) => ({
    id: r.id,
    event: r.event,
    envelopeId: r.envelopeId,
    envelopeSubject: r.envelope.subject,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt.toISOString(),
  }))

  return NextResponse.json(
    { events },
    {
      headers: {
        // Polled by the dashboard every 5s; no caching at the CDN layer.
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
