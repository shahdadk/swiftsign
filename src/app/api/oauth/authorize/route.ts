import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { mintAuthCode, OAUTH_SCOPES } from '@/lib/oauth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Consent decision (form POST from /oauth/authorize). Session-gated; all
// parameters re-validated server-side — never trust the rendered form alone.

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.redirect(new URL('/dashboard/login', request.url), 303)
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Bad form' }, { status: 400 })
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : ''
  }

  const decision = get('decision')
  const clientId = get('client_id')
  const redirectUri = get('redirect_uri')
  const scope = get('scope')
  const state = get('state')
  const codeChallenge = get('code_challenge')
  const resource = get('resource')

  const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } })
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: 'Invalid client or redirect_uri' }, { status: 400 })
  }

  const target = new URL(redirectUri)
  if (state) target.searchParams.set('state', state)

  if (decision !== 'approve') {
    target.searchParams.set('error', 'access_denied')
    return NextResponse.redirect(target, 303)
  }

  const scopes = scope ? scope.split(' ').filter(Boolean) : OAUTH_SCOPES
  if (scopes.some((s) => !OAUTH_SCOPES.includes(s)) || !codeChallenge) {
    target.searchParams.set('error', 'invalid_request')
    return NextResponse.redirect(target, 303)
  }

  const code = await mintAuthCode({
    clientId,
    userId: user.id,
    redirectUri,
    scopes,
    codeChallenge,
    resource: resource || null,
  })
  logger.info('oauth consent approved', { clientId, userId: user.id })

  target.searchParams.set('code', code)
  return NextResponse.redirect(target, 303)
}
