import { prisma } from './db'
import type { User } from '../generated/prisma/client'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { env } from './env'

// --- API Key auth (for programmatic access via Claude Code / MCP) ---

export async function authenticateApiKey(
  request: Request
): Promise<User | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const apiKey = parts[1]
  if (!apiKey) return null

  const user = await prisma.user.findUnique({
    where: { apiKey },
  })

  return user
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

export async function createMagicLink(email: string): Promise<string | null> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`
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

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        apiKey: `sk_${crypto.randomBytes(16).toString('hex')}`,
      },
    })
  }

  return user
}

// Keep NextAuth exports as no-ops so existing imports don't break
export const auth = getSession
