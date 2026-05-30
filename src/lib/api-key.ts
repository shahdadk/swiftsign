import crypto from 'crypto'
import { prisma } from './db'
import type { ApiKey, ApiKeyMode } from '@/generated/prisma/client'

// API key generation + hashing. Keys are high-entropy random tokens, so a fast
// hash (SHA-256) with a unique-index lookup is the right pattern (Stripe/GitHub
// model) — not bcrypt, which would force a table scan. The plaintext secret is
// returned exactly once at creation and never stored.

export const DEFAULT_SCOPES = ['envelopes:read', 'envelopes:write']

export function hashApiKey(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export function generateApiKeySecret(mode: ApiKeyMode): string {
  const prefix = mode === 'TEST' ? 'sk_test_' : 'sk_live_'
  return prefix + crypto.randomBytes(24).toString('hex')
}

export interface CreatedApiKey {
  secret: string
  record: ApiKey
}

export async function createApiKey(
  userId: string,
  opts: {
    name?: string | null
    mode?: ApiKeyMode
    scopes?: string[]
    expiresAt?: Date | null
  } = {}
): Promise<CreatedApiKey> {
  const mode = opts.mode ?? 'LIVE'
  const secret = generateApiKeySecret(mode)
  const record = await prisma.apiKey.create({
    data: {
      userId,
      name: opts.name ?? null,
      hashedKey: hashApiKey(secret),
      prefix: secret.slice(0, 16),
      last4: secret.slice(-4),
      mode,
      scopes: opts.scopes ?? DEFAULT_SCOPES,
      expiresAt: opts.expiresAt ?? null,
    },
  })
  return { secret, record }
}

// Public, never-secret view of a key for the dashboard / list endpoints.
export function publicApiKeyView(k: ApiKey) {
  return {
    id: k.id,
    name: k.name,
    mode: k.mode,
    prefix: k.prefix,
    last4: k.last4,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
  }
}
