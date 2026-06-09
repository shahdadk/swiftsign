import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

// RFC 8414 authorization-server metadata. SwiftSign is both the resource
// server (the /mcp endpoint) and the authorization server.

export const dynamic = 'force-static'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-protocol-version',
}

export async function GET() {
  const issuer = env.NEXT_PUBLIC_APP_URL
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['envelopes:read', 'envelopes:write'],
      service_documentation: `${issuer}/docs`,
    },
    { headers: CORS }
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
