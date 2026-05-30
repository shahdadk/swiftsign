import { describe, it, expect } from 'vitest'
import {
  encodeCursor,
  decodeCursor,
  parseLimit,
  buildPage,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@/lib/pagination'

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a row through encode -> decode', () => {
    const createdAt = new Date('2026-05-30T12:34:56.789Z')
    const id = 'env_abc123'
    const cursor = encodeCursor({ id, createdAt })
    const decoded = decodeCursor(cursor)
    expect(decoded).not.toBeNull()
    expect(decoded!.id).toBe(id)
    expect(decoded!.createdAt.toISOString()).toBe(createdAt.toISOString())
  })

  it('returns null for empty / nullish cursors', () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('returns null for malformed cursors', () => {
    expect(decodeCursor('not-base64-$$$')).toBeNull()
    expect(decodeCursor(Buffer.from('{"nope":1}').toString('base64url'))).toBeNull()
  })
})

describe('parseLimit', () => {
  it('defaults to DEFAULT_LIMIT for missing input', () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIMIT)
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT)
    expect(parseLimit('')).toBe(DEFAULT_LIMIT)
  })

  it('defaults for junk / out-of-range input', () => {
    expect(parseLimit('abc')).toBe(DEFAULT_LIMIT)
    expect(parseLimit('0')).toBe(DEFAULT_LIMIT)
    expect(parseLimit('-5')).toBe(DEFAULT_LIMIT)
  })

  it('clamps to MAX_LIMIT', () => {
    expect(parseLimit('100')).toBe(MAX_LIMIT)
    expect(parseLimit('1000')).toBe(MAX_LIMIT)
  })

  it('passes through valid in-range values', () => {
    expect(parseLimit('10')).toBe(10)
    expect(parseLimit('1')).toBe(1)
  })
})

describe('buildPage', () => {
  const row = (id: string) => ({ id, createdAt: new Date(`2026-05-${id.padStart(2, '0')}T00:00:00Z`) })

  it('reports has_more=false and null cursor when rows <= limit', () => {
    const rows = [row('01'), row('02')]
    const page = buildPage(rows, 5)
    expect(page.has_more).toBe(false)
    expect(page.next_cursor).toBeNull()
    expect(page.data).toHaveLength(2)
  })

  it('reports has_more=true, trims to limit, and emits a cursor when given limit+1 rows', () => {
    const limit = 2
    const rows = [row('01'), row('02'), row('03')] // limit + 1
    const page = buildPage(rows, limit)
    expect(page.has_more).toBe(true)
    expect(page.data).toHaveLength(limit)
    expect(page.data.map((r) => r.id)).toEqual(['01', '02'])
    expect(page.next_cursor).not.toBeNull()
    // Cursor points at the last returned row (id '02'), not the dropped overflow row.
    expect(decodeCursor(page.next_cursor)!.id).toBe('02')
  })

  it('handles an empty result set', () => {
    const page = buildPage([], 25)
    expect(page.has_more).toBe(false)
    expect(page.next_cursor).toBeNull()
    expect(page.data).toEqual([])
  })
})
