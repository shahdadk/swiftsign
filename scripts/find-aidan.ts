import { prisma } from '../src/lib/db'

async function main() {
  const recipients = await prisma.recipient.findMany({
    where: {
      OR: [
        { email: { contains: 'aidan', mode: 'insensitive' } },
        { name: { contains: 'aidan', mode: 'insensitive' } },
        { name: { contains: 'dizaji', mode: 'insensitive' } },
        { email: { contains: 'dizaji', mode: 'insensitive' } },
      ],
    },
    select: { name: true, email: true },
    distinct: ['email'],
  })
  console.log(JSON.stringify(recipients, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
