import { prisma } from './db'
import type { AuditEvent, Prisma } from '../generated/prisma/client'

interface AuditData {
  actorName?: string
  actorEmail?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(
  envelopeId: string,
  event: AuditEvent,
  data: AuditData = {}
) {
  return prisma.auditLog.create({
    data: {
      envelopeId,
      event,
      actorName: data.actorName ?? null,
      actorEmail: data.actorEmail ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      metadata: data.metadata
        ? (data.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  })
}
