import { prisma } from '../src/lib/db'

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      plan: true,
      apiKey: true,
      _count: { select: { envelopes: true } },
    },
    take: 5,
  })
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
