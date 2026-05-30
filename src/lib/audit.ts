import { prisma } from './db'
import type { AuditEvent, Prisma } from '../generated/prisma/client'
import { canonicalAuditPayload, computeRowHash } from './audit-hash'

interface AuditData {
  actorName?: string
  actorEmail?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

// Append-only, hash-chained audit write. Each row stores a per-envelope
// monotonic `seq`, the previous row's `rowHash`, and its own
// `rowHash = sha256(canonical(row) || prevHash)`. The DB enforces append-only
// via triggers; the chain makes any tampering detectable.
//
// Pass `tx` when writing inside an existing transaction (the sign route writes
// several events) so the chain links are consistent and ordered. Without `tx`
// we open our own transaction so the locked read + insert are atomic.
async function appendAudit(
  db: Prisma.TransactionClient,
  envelopeId: string,
  event: AuditEvent,
  data: AuditData
) {
  // Lock the latest chained row for this envelope so two concurrent appends
  // can't compute the same seq and fork the chain.
  const prev = await db.$queryRaw<Array<{ seq: number; rowHash: string | null }>>`
    SELECT "seq", "rowHash" FROM "AuditLog"
    WHERE "envelopeId" = ${envelopeId} AND "seq" IS NOT NULL
    ORDER BY "seq" DESC
    LIMIT 1
    FOR UPDATE
  `
  const prevSeq = prev[0]?.seq ?? 0
  const prevHash = prev[0]?.rowHash ?? null
  const seq = prevSeq + 1
  const createdAt = new Date()
  const actorName = data.actorName ?? null
  const actorEmail = data.actorEmail ?? null
  const ipAddress = data.ipAddress ?? null
  const userAgent = data.userAgent ?? null
  const metadata = data.metadata ?? null

  const canonical = canonicalAuditPayload({
    seq,
    envelopeId,
    event,
    actorName,
    actorEmail,
    ipAddress,
    userAgent,
    metadata,
    createdAt,
  })
  const rowHash = computeRowHash(canonical, prevHash)

  return db.auditLog.create({
    data: {
      envelopeId,
      event,
      actorName,
      actorEmail,
      ipAddress,
      userAgent,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
      seq,
      prevHash,
      rowHash,
      createdAt,
    },
  })
}

export async function logAudit(
  envelopeId: string,
  event: AuditEvent,
  data: AuditData = {},
  tx?: Prisma.TransactionClient
) {
  if (tx) return appendAudit(tx, envelopeId, event, data)
  return prisma.$transaction((t) => appendAudit(t, envelopeId, event, data))
}
