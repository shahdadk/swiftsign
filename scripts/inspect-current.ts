// Inspect envelope state + audit log.
// Usage: npx tsx --env-file=.env.local scripts/inspect-current.ts [envelopeId]
//        (if no id supplied, dumps the 5 most recent envelopes)

import { prisma } from '../src/lib/db'

async function main() {
  const envelopeId = process.argv[2]

  if (!envelopeId) {
    const recent = await prisma.envelope.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        recipients: { select: { name: true, email: true, status: true } },
      },
    })
    console.log(`\n${recent.length} most recent envelopes:`)
    for (const e of recent) {
      console.log(`\n  ${e.id}`)
      console.log(`    ${e.subject}`)
      console.log(`    ${e.status}, created ${e.createdAt.toISOString()}`)
      for (const r of e.recipients) {
        console.log(`    - [${r.status}] ${r.name} <${r.email}>`)
      }
    }
    console.log(`\nFor details: npx tsx --env-file=.env.local scripts/inspect-current.ts <envelopeId>\n`)
    return
  }

  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      documents: {
        select: {
          id: true,
          name: true,
          pageCount: true,
          imageKeys: true,
          originalKey: true,
          signedKey: true,
          documentHash: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      },
      recipients: {
        select: { name: true, email: true, status: true, routingOrder: true, signedAt: true, signingToken: true },
      },
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  })

  console.log(`Envelope: ${env.subject}`)
  console.log(`Status:   ${env.status}`)
  console.log(`Created:  ${env.createdAt.toISOString()}`)
  console.log(`Updated:  ${env.updatedAt.toISOString()}`)
  console.log()
  console.log('Documents:')
  for (const d of env.documents) {
    console.log(`  ${d.order}. ${d.name}`)
    console.log(`     id:         ${d.id}`)
    console.log(`     originalKey: ${d.originalKey}`)
    console.log(`     signedKey:   ${d.signedKey ?? '(none)'}`)
    console.log(`     hash:        ${d.documentHash ?? '(none)'}`)
  }
  console.log()
  console.log('Recipients:')
  for (const r of env.recipients) {
    console.log(`  ${r.routingOrder}. [${r.status}] ${r.name} <${r.email}>`)
    console.log(`     signed:  ${r.signedAt?.toISOString() ?? '—'}`)
  }
  console.log()
  console.log(`Audit log (${env.auditLogs.length} entries):`)
  for (const a of env.auditLogs.slice(-20)) {
    console.log(`  ${a.createdAt.toISOString()} ${a.event} ${a.actorEmail ?? ''} ${JSON.stringify(a.metadata ?? {}).slice(0, 80)}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
