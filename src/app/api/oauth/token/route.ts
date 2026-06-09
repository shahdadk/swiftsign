import { NextResponse } from 'next/server'
import { exchangeAuthCode, rotateRefreshToken } from '@/lib/oauth'
import { authVerifyLimiter, clientIp, rateLimitHeaders } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 6749 token endpoint (form-encoded, OAuth-style error JSON — MCP clients
// expect {"error": ...}, not problem+json, on this one endpoint).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-protocol-version',
}

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...CORS, 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  const rl = await authVerifyLimiter.limit(clientIp(request))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'slow_down', error_description: 'Too many requests' },
      { status: 429, headers: { ...rateLimitHeaders(rl), ...CORS } }
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) return oauthError('invalid_request', 'Expected application/x-www-form-urlencoded')
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : ''
  }

  const grantType = get('grant_type')

  if (grantType === 'authorization_code') {
    const code = get('code')
    const clientId = get('client_id')
    const redirectUri = get('redirect_uri')
    const codeVerifier = get('code_verifier')
    if (!code || !clientId || !redirectUri || !codeVerifier) {
      return oauthError(
        'invalid_request',
        'code, client_id, redirect_uri, and code_verifier are required'
      )
    }
    const result = await exchangeAuthCode({ code, clientId, redirectUri, codeVerifier })
    if ('error' in result) return oauthError(result.error, result.description)
    return NextResponse.json(result, {
      headers: { ...CORS, 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    })
  }

  if (grantType === 'refresh_token') {
    const refreshToken = get('refresh_token')
    const clientId = get('client_id')
    if (!refreshToken || !clientId) {
      return oauthError('invalid_request', 'refresh_token and client_id are required')
    }
    const result = await rotateRefreshToken({ refreshToken, clientId })
    if ('error' in result) return oauthError(result.error, result.description)
    return NextResponse.json(result, {
      headers: { ...CORS, 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    })
  }

  return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token')
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
