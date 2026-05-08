import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createMagicLink } from '@/lib/auth'
import { sendMagicLink } from '@/lib/email'
import { logger } from '@/lib/logger'
import { authSendLimiter, clientIp, rateLimitHeaders } from '@/lib/rate-limit'
import { isEmailAllowed } from '@/lib/env'

const Body = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = await authSendLimiter.limit(ip)
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  try {
    const json = await request.json().catch(() => null)
    const parsed = Body.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (!isEmailAllowed(parsed.data.email)) {
      // Closed beta — pretend success so we don't leak the allowlist via timing/error
      logger.info('auth_send_blocked_by_allowlist', { email: parsed.data.email })
      return NextResponse.json({ success: true })
    }

    const link = await createMagicLink(parsed.data.email)
    if (!link) {
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
    }

    const { error } = await sendMagicLink(parsed.data.email, link)
    if (error) {
      logger.error(error, { route: 'POST /api/auth/send' })
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error(err, { route: 'POST /api/auth/send' })
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
