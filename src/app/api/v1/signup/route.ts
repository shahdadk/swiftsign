import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createApiKey, publicApiKeyView } from '@/lib/api-key'
import { signupVelocityLimiter, clientIp, rateLimitHeaders } from '@/lib/rate-limit'
import { TOS_VERSION } from '@/lib/legal'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Agent-callable signup: one unauthenticated call provisions a sandbox account
// and returns a sk_test_ key, so an agent/curl is productive immediately with no
// browser. LIVE mode (real sends + billing) is gated behind email verification
// (the magic link) + the pay link from /api/v1/billing/upgrade.
const Body = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  source: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9_-]+$/i)
    .optional(),
})

export async function POST(request: Request) {
  const ip = clientIp(request)
  const rl = await signupVelocityLimiter.limit(ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many signups from this IP. Try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  const email = parsed.data.email.trim().toLowerCase()
  // Funnel attribution: body field wins; ?source= covers curl/docs links.
  const querySource = new URL(request.url).searchParams.get('source')
  const source =
    parsed.data.source ??
    (querySource && /^[a-z0-9_-]{1,40}$/i.test(querySource) ? querySource : null)

  try {
    // Never mint a key for an already-claimed email — that would be account
    // takeover. Direct existing accounts to sign in instead.
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        {
          error: 'An account with this email already exists. Sign in to manage your keys.',
          login_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/login`,
        },
        { status: 409 }
      )
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        tosAcceptedVersion: TOS_VERSION,
        tosAcceptedAt: new Date(),
        signupSource: source,
      },
    })
    const { secret, record } = await createApiKey(user.id, {
      name: 'Default',
      mode: 'TEST',
    })
    logger.info('signup', { userId: user.id, source })

    return NextResponse.json(
      {
        api_key: secret,
        mode: 'test',
        key: publicApiKeyView(record),
        message:
          'Sandbox account created. This is a TEST key — sends are watermarked and free. Verify your email and add a card to go live.',
        verify_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/login`,
        docs_url: `${env.NEXT_PUBLIC_APP_URL}/docs`,
        terms_url: `${env.NEXT_PUBLIC_APP_URL}/legal/terms`,
        privacy_url: `${env.NEXT_PUBLIC_APP_URL}/legal/privacy`,
      },
      { status: 201 }
    )
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/signup' })
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
