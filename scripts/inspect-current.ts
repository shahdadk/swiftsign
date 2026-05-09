import { prisma } from '../src/lib/db'

async function main() {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: 'aa7c1e06-6f67-4b26-92b9-3ab4143fd754' },
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
