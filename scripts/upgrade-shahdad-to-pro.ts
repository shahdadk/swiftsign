// One-off: upgrade Shahdad's SwiftSign account from FREE -> PRO so the
// /api/v1/envelopes rate limit moves from 10/hr to 100/hr. Run with:
//   npx tsx scripts/upgrade-shahdad-to-pro.ts
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'shahdad', mode: 'insensitive' } },
        { email: { contains: 'appfi.dev', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, plan: true, name: true },
  })
  console.log('candidates:', candidates)
  if (candidates.length === 0) {
    console.error('no shahdad user found')
    process.exit(1)
  }
  // Pick the most likely one (shahdadkompanizare@gmail.com or shahdad@appfi.dev)
  const pick =
    candidates.find((c) => c.email.toLowerCase() === 'shahdadkompanizare@gmail.com') ||
    candidates.find((c) => c.email.toLowerCase() === 'shahdad@appfi.dev') ||
    candidates[0]
  console.log('upgrading:', pick.email, 'from', pick.plan, '-> PRO')
  await prisma.user.update({ where: { id: pick.id }, data: { plan: 'PRO' } })
  const after = await prisma.user.findUnique({ where: { id: pick.id }, select: { email: true, plan: true } })
  console.log('after:', after)
}

main().finally(() => prisma.$disconnect())
