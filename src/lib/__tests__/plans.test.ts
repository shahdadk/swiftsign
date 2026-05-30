import { describe, it, expect } from 'vitest'
import { isInGrace, planFromPriceId } from '@/lib/plans'

describe('isInGrace', () => {
  it('returns true when the grace window ends in the future', () => {
    expect(isInGrace(new Date(Date.now() + 60_000))).toBe(true)
  })

  it('returns false when the grace window has already ended', () => {
    expect(isInGrace(new Date(Date.now() - 60_000))).toBe(false)
  })

  it('returns false for null / undefined (no grace set)', () => {
    expect(isInGrace(null)).toBe(false)
    expect(isInGrace(undefined)).toBe(false)
  })
})

describe('planFromPriceId', () => {
  it('falls back to FREE for an unknown price id', () => {
    // Stripe price env vars are unset under the test stub, so every id is unknown.
    expect(planFromPriceId('price_does_not_exist')).toBe('FREE')
    expect(planFromPriceId('')).toBe('FREE')
  })
})
