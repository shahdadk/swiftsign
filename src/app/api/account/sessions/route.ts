import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.session.deleteMany({ where: { userId: user.id } })
    const cookieStore = await cookies()
    cookieStore.delete('swiftsign_session')
    logger.info('all_sessions_revoked', { userId: user.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error(err, {
      route: 'DELETE /api/account/sessions',
      userId: user.id,
    })
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    )
  }
}
