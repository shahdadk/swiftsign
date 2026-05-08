import { prisma } from '../src/lib/db'

async function main() {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: 'aa7c1e06-6f67-4b26-92b9-3ab4143fd754' },
    include: {
      recipients: { include: { fields: { include: { document: { select: { name: true } } } } } },
    },
  })
  for (const r of env.recipients) {
    console.log(`\n${r.name} <${r.email}> [order=${r.routingOrder}, status=${r.status}]`)
    console.log(`  Sign URL: https://swiftsign.ca/sign/${r.signingToken}`)
    console.log(`  ${r.fields.length} fields:`)
    for (const f of r.fields) {
      console.log(`    - ${f.type.padEnd(10)} on ${f.document.name} page ${f.page} @ x=${f.x}% y=${f.y}%`)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
