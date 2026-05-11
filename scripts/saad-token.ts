import { prisma } from '../src/lib/db'

async function main() {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: '0e501be8-02d0-4e26-8d07-9d819a35580c' },
    include: {
      recipients: { select: { name: true, email: true, signingToken: true } },
    },
  })
  for (const r of env.recipients) {
    console.log(`${r.name} <${r.email}>`)
    console.log(`  Sign:    https://swiftsign.ca/sign/${r.signingToken}`)
    console.log(`  Preview: https://swiftsign.ca/sign/${r.signingToken}?preview=1`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
