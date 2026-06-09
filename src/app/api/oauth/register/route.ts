import { NextResponse } from 'next/server'
import { z } from 'zod'
import { registerClient, isValidRedirectUri } from '@/lib/oauth'
import { dcrLimiter, clientIp, rateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 7591 dynamic client registration. Open registration, public clients
// only (no secrets issued) — the per-user gate is the consent screen + PKCE.

const Body = z.object({
  client_name: z.string().max(120).optional(),
  redirect_uris: z.array(z.string()).min(1).max(10),
  token_endpoint_auth_method: z.literal('none').optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-protocol-version',
}

export async function POST(request: Request) {
  const rl = await dcrLimiter.limit(clientIp(request))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Too many registrations' },
      { status: 429, headers: { ...rateLimitHeaders(rl), ...CORS } }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'redirect_uris (1-10) required' },
      { status: 400, headers: CORS }
    )
  }

  const bad = parsed.data.redirect_uris.find((u) => !isValidRedirectUri(u))
  if (bad) {
    return NextResponse.json(
      {
        error: 'invalid_redirect_uri',
        error_description: `Redirect URIs must be https or http://127.0.0.1 loopback (got ${bad})`,
      },
      { status: 400, headers: CORS }
    )
  }

  const client = await registerClient({
    name: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  })
  logger.info('oauth client registered', { clientId: client.id })

  return NextResponse.json(
    {
      client_id: client.id,
      client_name: client.name ?? undefined,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: CORS }
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
