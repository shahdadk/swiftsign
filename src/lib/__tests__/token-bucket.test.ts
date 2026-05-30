import { describe, it, expect } from 'vitest'
import { takeToken } from '@/lib/token-bucket'

// In-memory token bucket — the fail-closed fallback when Upstash is down.
// Buckets are keyed in a module-level Map, so each test uses a unique key to
// stay isolated from the others.

describe('takeToken', () => {
  it('allows exactly `capacity` requests, then throttles', () => {
    const key = `cap-${Math.random()}`
    const capacity = 5

    for (let i = 0; i < capacity; i++) {
      expect(takeToken(key, capacity, 0)).toBe(true)
    }
    // Bucket is now empty and refillPerSec=0 means no replenishment.
    expect(takeToken(key, capacity, 0)).toBe(false)
    expect(takeToken(key, capacity, 0)).toBe(false)
  })

  it('treats a fresh key as a full bucket', () => {
    const key = `fresh-${Math.random()}`
    expect(takeToken(key, 1, 0)).toBe(true)
    expect(takeToken(key, 1, 0)).toBe(false)
  })

  it('refills over elapsed wall-clock time', async () => {
    const key = `refill-${Math.random()}`
    // Capacity 1, refill 100 tokens/sec. Drain it, wait, expect a refill.
    expect(takeToken(key, 1, 100)).toBe(true)
    expect(takeToken(key, 1, 100)).toBe(false)
    // 50ms * 100/s = ~5 tokens of refill (clamped to capacity 1), enough for 1.
    await new Promise((r) => setTimeout(r, 50))
    expect(takeToken(key, 1, 100)).toBe(true)
  })
})
