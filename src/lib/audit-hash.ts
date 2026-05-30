import crypto from 'crypto'
import type { AuditEvent } from '@/generated/prisma/client'

// Shared canonicalization + hashing for the tamper-evident audit chain. Both the
// write path (lib/audit.ts) and the verifier (lib/audit-verify.ts) MUST use
// these so a recomputed hash matches byte-for-byte.

export interface AuditRowForHash {
  seq: number
  envelopeId: string
  event: AuditEvent | string
  actorName: string | null
  actorEmail: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: Date
}

// Deterministic JSON with recursively sorted keys, so object key ordering in
// `metadata` can't drift the hash.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  )
}

export function canonicalAuditPayload(row: AuditRowForHash): string {
  return stableStringify({
    seq: row.seq,
    envelopeId: row.envelopeId,
    event: row.event,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  })
}

export const GENESIS = 'GENESIS'

export function computeRowHash(canonical: string, prevHash: string | null): string {
  return crypto
    .createHash('sha256')
    .update(canonical + (prevHash ?? GENESIS))
    .digest('hex')
}
