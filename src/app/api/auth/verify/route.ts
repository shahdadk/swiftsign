import { NextResponse } from 'next/server'
import { verifyMagicLink, createSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import { authVerifyLimiter, clientIp, rateLimitHeaders } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const ip = clientIp(request)
  const limit = await authVerifyLimiter.limit(ip)
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')

  if (!token || !email) {
    return NextResponse.redirect(new URL('/dashboard/login?error=invalid', request.url))
  }

  const user = await verifyMagicLink(token, email)
  if (!user) {
    return NextResponse.redirect(new URL('/dashboard/login?error=expired', request.url))
  }

  const sessionToken = await createSession(user.id)

  const cookieStore = await cookies()
  cookieStore.set('swiftsign_session', sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
