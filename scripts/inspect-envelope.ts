import { prisma } from '../src/lib/db'

async function main() {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: 'c14d854c-5a52-46c9-8fd4-8ebd8afdff7e' },
    include: {
      documents: {
        select: {
          id: true,
          name: true,
          pageCount: true,
          imageKeys: true,
          originalKey: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      },
      recipients: {
        select: { name: true, email: true, status: true, routingOrder: true },
      },
      auditLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  console.log(JSON.stringify(env, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
