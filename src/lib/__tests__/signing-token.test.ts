import { describe, it, expect } from 'vitest'
import { newSigningToken, isTokenExpired } from '@/lib/signing-token'

describe('newSigningToken', () => {
  it('is 64 hex chars (32 random bytes)', () => {
    expect(newSigningToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is unique across calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(newSigningToken())
    expect(seen.size).toBe(1000)
  })
})

describe('isTokenExpired', () => {
  it('returns true for a past expiry', () => {
    expect(isTokenExpired(new Date(Date.now() - 60_000))).toBe(true)
  })

  it('returns false for a future expiry', () => {
    expect(isTokenExpired(new Date(Date.now() + 60_000))).toBe(false)
  })

  it('returns false for null / undefined (no expiry set)', () => {
    expect(isTokenExpired(null)).toBe(false)
    expect(isTokenExpired(undefined)).toBe(false)
  })
})
