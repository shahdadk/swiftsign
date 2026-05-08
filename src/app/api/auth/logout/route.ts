import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('swiftsign_session')?.value

  if (sessionToken) {
    try {
      await prisma.session.deleteMany({ where: { sessionToken } })
    } catch (err) {
      logger.error(err, { route: 'POST /api/auth/logout' })
    }
  }

  cookieStore.delete('swiftsign_session')

  const url = new URL(request.url)
  return NextResponse.redirect(new URL('/dashboard/login', url), { status: 303 })
}
