import { prisma } from '../src/lib/db'
async function main() {
  const env = await prisma.envelope.findUnique({
    where: { id: '6b8f84a6-e093-4a4b-bbc2-dc472935ec8c' },
    include: {
      recipients: { select: { name: true, email: true, signingToken: true, status: true, routingOrder: true } },
      documents: { select: { id: true, name: true, originalKey: true, pageCount: true, imageKeys: true } },
    },
  })
  console.log(JSON.stringify(env, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
