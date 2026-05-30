import { describe, it, expect } from 'vitest'
import {
  canonicalAuditPayload,
  computeRowHash,
  GENESIS,
  type AuditRowForHash,
} from '@/lib/audit-hash'

const baseRow = (metadata: unknown): AuditRowForHash => ({
  seq: 1,
  envelopeId: 'env_1',
  event: 'RECIPIENT_SIGNED',
  actorName: 'Ada',
  actorEmail: 'ada@example.com',
  ipAddress: '8.8.8.8',
  userAgent: 'jest',
  metadata,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
})

describe('canonicalAuditPayload', () => {
  it('is stable under metadata key reordering', () => {
    const a = canonicalAuditPayload(baseRow({ a: 1, b: 2, nested: { x: 1, y: 2 } }))
    const b = canonicalAuditPayload(baseRow({ b: 2, a: 1, nested: { y: 2, x: 1 } }))
    expect(a).toBe(b)
  })

  it('differs when a metadata value actually changes', () => {
    const a = canonicalAuditPayload(baseRow({ a: 1 }))
    const b = canonicalAuditPayload(baseRow({ a: 2 }))
    expect(a).not.toBe(b)
  })

  it('treats null and undefined metadata identically (?? null)', () => {
    expect(canonicalAuditPayload(baseRow(null))).toBe(
      canonicalAuditPayload(baseRow(undefined))
    )
  })
})

describe('computeRowHash', () => {
  it('is deterministic for the same canonical + prevHash', () => {
    const canonical = canonicalAuditPayload(baseRow({ a: 1 }))
    expect(computeRowHash(canonical, 'prev')).toBe(computeRowHash(canonical, 'prev'))
  })

  it('changes when prevHash changes (chain linkage)', () => {
    const canonical = canonicalAuditPayload(baseRow({ a: 1 }))
    const h1 = computeRowHash(canonical, 'prevA')
    const h2 = computeRowHash(canonical, 'prevB')
    expect(h1).not.toBe(h2)
  })

  it('treats null prevHash as GENESIS', () => {
    const canonical = canonicalAuditPayload(baseRow({ a: 1 }))
    expect(computeRowHash(canonical, null)).toBe(computeRowHash(canonical, GENESIS))
  })

  it('produces a 64-char hex sha256 digest', () => {
    const canonical = canonicalAuditPayload(baseRow({ a: 1 }))
    expect(computeRowHash(canonical, null)).toMatch(/^[0-9a-f]{64}$/)
  })
})
