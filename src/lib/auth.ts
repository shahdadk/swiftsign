import { prisma } from './db'
import type { ApiKey, User } from '../generated/prisma/client'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { env } from './env'
import { hashApiKey, createApiKey } from './api-key'
import { TOS_VERSION } from './legal'

// --- API Key auth (for programmatic access via Claude Code / MCP) ---

export interface ApiAuth {
  user: User
  apiKey: ApiKey
  livemode: boolean
}

export async function authenticateApiKey(
  request: Request
): Promise<ApiAuth | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const secret = parts[1]
  if (!secret) return null

  const hashed = hashApiKey(secret)
  const record = await prisma.apiKey.findUnique({
    where: { hashedKey: hashed },
    include: { user: true },
  })
  if (!record) return null
  if (record.revokedAt) return null
  if (record.expiresAt && record.expiresAt < new Date()) return null

  // Constant-time defense-in-depth (the unique-hash lookup already gates this,
  // but never short-circuit a credential compare on early bytes).
  const a = Buffer.from(record.hashedKey)
  const b = Buffer.from(hashed)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  // Fire-and-forget last-used stamp; never block auth on it.
  void prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { user: record.user, apiKey: record, livemode: record.mode === 'LIVE' }
}

export function apiKeyHasScope(apiKey: ApiKey, scope: string): boolean {
  return apiKey.scopes.includes(scope)
}

// --- Session auth (for dashboard) ---

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('swiftsign_session')?.value
  if (!sessionToken) return null

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  })

  if (!session || session.expires < new Date()) return null
  return session.user
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID()
  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })
  return sessionToken
}

// Post-login destinations must be relative and on a known surface — this is
// the open-redirect guard for the magic-link `next` round-trip.
export function isSafeNextPath(next: string): boolean {
  return (
    next.length <= 2000 &&
    !next.startsWith('//') &&
    (next.startsWith('/oauth/authorize') || next.startsWith('/dashboard'))
  )
}

export async function createMagicLink(email: string, next?: string): Promise<string | null> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  const nextParam =
    next && isSafeNextPath(next) ? `&next=${encodeURIComponent(next)}` : ''
  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}${nextParam}`
}

export async function verifyMagicLink(token: string, email: string): Promise<User | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  })

  if (!record || record.expires < new Date()) return null

  // Delete the used token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  })

  // Find or create user. New users get a default sandbox (test-mode) API key so
  // an agent is productive on first login; live keys are created explicitly.
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: { email, tosAcceptedVersion: TOS_VERSION, tosAcceptedAt: new Date() },
    })
    await createApiKey(user.id, { name: 'Default', mode: 'TEST' })
  }

  return user
}

// Keep NextAuth exports as no-ops so existing imports don't break
export const auth = getSession
