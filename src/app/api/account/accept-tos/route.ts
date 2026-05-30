import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { TOS_VERSION } from '@/lib/legal'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { tosAcceptedVersion: TOS_VERSION, tosAcceptedAt: new Date() },
    })
    return NextResponse.json({ ok: true, version: TOS_VERSION })
  } catch (err) {
    logger.error(err, { route: 'POST /api/account/accept-tos', userId: user.id })
    return NextResponse.json({ error: 'Failed to accept terms' }, { status: 500 })
  }
}
