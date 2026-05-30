import { describe, it, expect } from 'vitest'
import { hashApiKey, generateApiKeySecret, publicApiKeyView } from '@/lib/api-key'
import type { ApiKey } from '@/generated/prisma/client'

describe('hashApiKey', () => {
  it('is deterministic for the same input', () => {
    expect(hashApiKey('sk_test_abc')).toBe(hashApiKey('sk_test_abc'))
  })

  it('does not return the plaintext input', () => {
    const secret = 'sk_test_abc'
    expect(hashApiKey(secret)).not.toBe(secret)
  })

  it('produces a 64-char hex sha256 digest', () => {
    expect(hashApiKey('anything')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs for different inputs', () => {
    expect(hashApiKey('a')).not.toBe(hashApiKey('b'))
  })
})

describe('generateApiKeySecret', () => {
  it('uses the sk_test_ prefix for TEST mode', () => {
    expect(generateApiKeySecret('TEST').startsWith('sk_test_')).toBe(true)
  })

  it('uses the sk_live_ prefix for LIVE mode', () => {
    expect(generateApiKeySecret('LIVE').startsWith('sk_live_')).toBe(true)
  })

  it('is unique across calls', () => {
    expect(generateApiKeySecret('LIVE')).not.toBe(generateApiKeySecret('LIVE'))
  })
})

describe('publicApiKeyView', () => {
  it('omits the hashedKey (never exposed)', () => {
    const record = {
      id: 'key_1',
      userId: 'user_1',
      name: 'CI key',
      hashedKey: 'deadbeef',
      prefix: 'sk_live_abc12345',
      last4: 'wxyz',
      mode: 'LIVE',
      scopes: ['envelopes:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date('2026-05-30T00:00:00Z'),
    } as unknown as ApiKey

    const view = publicApiKeyView(record)
    expect('hashedKey' in view).toBe(false)
    expect('userId' in view).toBe(false)
    expect(view.id).toBe('key_1')
    expect(view.last4).toBe('wxyz')
  })
})
