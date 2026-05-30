import { prisma } from './db'
import type { Prisma } from '../generated/prisma/client'
import { logAudit } from './audit'

// Versioned ESIGN/UETA consumer disclosure + per-signer consent capture. The
// disclosure must be accepted BEFORE the signer can access the document; the
// exact version shown is recorded with IP/UA/timestamp for attribution.

export async function getActiveDisclosure() {
  return prisma.consentDisclosure.findFirst({
    where: { isActive: true },
    orderBy: { effectiveAt: 'desc' },
  })
}

export async function recordConsent(args: {
  recipientId: string
  envelopeId: string
  ipAddress: string
  userAgent: string
  tx?: Prisma.TransactionClient
}) {
  const disclosure = await getActiveDisclosure()
  if (!disclosure) {
    throw new Error('No active consent disclosure configured')
  }
  const db = args.tx ?? prisma
  const record = await db.consentRecord.create({
    data: {
      recipientId: args.recipientId,
      disclosureId: disclosure.id,
      disclosureVersion: disclosure.version,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    },
  })
  await db.recipient.update({
    where: { id: args.recipientId },
    data: { consentedAt: new Date() },
  })
  await logAudit(
    args.envelopeId,
    'ESIGN_CONSENT_ACCEPTED',
    {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: { disclosureVersion: disclosure.version, consentRecordId: record.id },
    },
    args.tx
  )
  return record
}
