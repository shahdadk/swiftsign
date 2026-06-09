import crypto from 'crypto'
import { prisma } from './db'
import { hashApiKey, DEFAULT_SCOPES } from './api-key'

// OAuth 2.1 plumbing for the hosted MCP endpoint. Public clients only (PKCE
// S256, no client secrets). Access tokens ARE ApiKey rows with an sk_oat_
// prefix and a 24h expiry, so authenticateApiKey() and dashboard revocation
// work on them unchanged.

export const OAUTH_SCOPES = DEFAULT_SCOPES // envelopes:read, envelopes:write
const AUTH_CODE_TTL_MS = 10 * 60 * 1000
const ACCESS_TOKEN_TTL_S = 24 * 60 * 60
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function sha256b64url(input: string): string {
  return b64url(crypto.createHash('sha256').update(input).digest())
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false
  const computed = Buffer.from(sha256b64url(verifier))
  const expected = Buffer.from(challenge)
  return (
    computed.length === expected.length && crypto.timingSafeEqual(computed, expected)
  )
}

// https for real clients; loopback http for CLIs (RFC 8252).
export function isValidRedirectUri(uri: string): boolean {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return false
  }
  if (u.protocol === 'https:') return true
  if (u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost'))
    return true
  return false
}

export async function registerClient(input: {
  name?: string
  redirectUris: string[]
}): Promise<{ id: string; name: string | null; redirectUris: string[] }> {
  const client = await prisma.oAuthClient.create({
    data: {
      name: input.name ?? null,
      redirectUris: input.redirectUris,
    },
  })
  return { id: client.id, name: client.name, redirectUris: client.redirectUris }
}

export async function mintAuthCode(input: {
  clientId: string
  userId: string
  redirectUri: string
  scopes: string[]
  codeChallenge: string
  resource?: string | null
}): Promise<string> {
  const code = 'ac_' + crypto.randomBytes(32).toString('hex')
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: hashApiKey(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
      resource: input.resource ?? null,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  })
  return code
}

export interface TokenPair {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

async function mintTokenPair(
  clientId: string,
  userId: string,
  scopes: string[],
  clientName: string | null
): Promise<TokenPair> {
  const accessSecret = 'sk_oat_' + crypto.randomBytes(24).toString('hex')
  const accessKey = await prisma.apiKey.create({
    data: {
      userId,
      name: `OAuth: ${clientName ?? clientId.slice(0, 8)}`,
      hashedKey: hashApiKey(accessSecret),
      prefix: accessSecret.slice(0, 16),
      last4: accessSecret.slice(-4),
      mode: 'LIVE',
      scopes,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
    },
  })

  const refreshSecret = 'rt_' + crypto.randomBytes(32).toString('hex')
  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash: hashApiKey(refreshSecret),
      clientId,
      userId,
      scopes,
      accessKeyId: accessKey.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  })

  return {
    access_token: accessSecret,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshSecret,
    scope: scopes.join(' '),
  }
}

export async function exchangeAuthCode(input: {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): Promise<TokenPair | { error: string; description: string }> {
  const row = await prisma.oAuthAuthCode.findUnique({
    where: { codeHash: hashApiKey(input.code) },
  })
  if (!row) return { error: 'invalid_grant', description: 'Unknown authorization code' }
  if (row.usedAt) {
    return { error: 'invalid_grant', description: 'Authorization code already used' }
  }
  if (row.expiresAt < new Date()) {
    return { error: 'invalid_grant', description: 'Authorization code expired' }
  }
  if (row.clientId !== input.clientId) {
    return { error: 'invalid_grant', description: 'client_id mismatch' }
  }
  if (row.redirectUri !== input.redirectUri) {
    return { error: 'invalid_grant', description: 'redirect_uri mismatch' }
  }
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) {
    return { error: 'invalid_grant', description: 'PKCE verification failed' }
  }

  await prisma.oAuthAuthCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  })

  const client = await prisma.oAuthClient.findUnique({ where: { id: row.clientId } })
  return mintTokenPair(row.clientId, row.userId, row.scopes, client?.name ?? null)
}

export async function rotateRefreshToken(input: {
  refreshToken: string
  clientId: string
}): Promise<TokenPair | { error: string; description: string }> {
  const row = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash: hashApiKey(input.refreshToken) },
  })
  if (!row || row.revokedAt) {
    return { error: 'invalid_grant', description: 'Unknown or revoked refresh token' }
  }
  if (row.expiresAt < new Date()) {
    return { error: 'invalid_grant', description: 'Refresh token expired' }
  }
  if (row.clientId !== input.clientId) {
    return { error: 'invalid_grant', description: 'client_id mismatch' }
  }

  // Rotate: revoke this refresh token and its access key, mint a fresh pair.
  await prisma.oAuthRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  })
  if (row.accessKeyId) {
    await prisma.apiKey
      .update({ where: { id: row.accessKeyId }, data: { revokedAt: new Date() } })
      .catch(() => {})
  }

  const client = await prisma.oAuthClient.findUnique({ where: { id: row.clientId } })
  return mintTokenPair(row.clientId, row.userId, row.scopes, client?.name ?? null)
}
