import { prisma } from '@/lib/db'
import { canonicalAuditPayload, computeRowHash } from '@/lib/audit-hash'

export interface VerifyChainResult {
  ok: boolean
  brokenAtSeq?: number
  head?: string
  count: number
}

// Re-walk the per-envelope hash chain and prove it hasn't been tampered with.
// For each chained row (seq != null) we assert seq is contiguous from 1, that
// the stored prevHash links to the prior row's stored rowHash, and that the
// rowHash recomputes to the stored value from the row's own canonical payload.
export async function verifyChain(envelopeId: string): Promise<VerifyChainResult> {
  const rows = await prisma.auditLog.findMany({
    where: { envelopeId, seq: { not: null } },
    orderBy: { seq: 'asc' },
    select: {
      seq: true,
      envelopeId: true,
      event: true,
      actorName: true,
      actorEmail: true,
      ipAddress: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
      prevHash: true,
      rowHash: true,
    },
  })

  let prevHash: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const expectedSeq = i + 1

    // seq is non-null in the query, but Prisma's type keeps it nullable.
    if (row.seq !== expectedSeq) {
      return { ok: false, brokenAtSeq: row.seq ?? expectedSeq, count: rows.length }
    }

    if ((row.prevHash ?? null) !== prevHash) {
      return { ok: false, brokenAtSeq: expectedSeq, count: rows.length }
    }

    const canonical = canonicalAuditPayload({
      seq: row.seq,
      envelopeId: row.envelopeId,
      event: row.event,
      actorName: row.actorName,
      actorEmail: row.actorEmail,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: row.metadata,
      createdAt: row.createdAt,
    })
    const recomputed = computeRowHash(canonical, prevHash)

    if (recomputed !== row.rowHash) {
      return { ok: false, brokenAtSeq: expectedSeq, count: rows.length }
    }

    prevHash = row.rowHash
  }

  return {
    ok: true,
    head: prevHash ?? undefined,
    count: rows.length,
  }
}

export interface AuditTrailEntry {
  seq: number | null
  event: string
  actorName: string | null
  actorEmail: string | null
  ipAddress: string | null
  createdAt: Date
  rowHash: string | null
}

// All audit rows for an envelope (chained and pre-chain), in chronological
// order, shaped for rendering in a certificate or the verification UI.
export async function getAuditTrail(envelopeId: string): Promise<AuditTrailEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { envelopeId },
    orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }],
    select: {
      seq: true,
      event: true,
      actorName: true,
      actorEmail: true,
      ipAddress: true,
      createdAt: true,
      rowHash: true,
    },
  })

  return rows.map((row) => ({
    seq: row.seq,
    event: row.event,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    rowHash: row.rowHash,
  }))
}
