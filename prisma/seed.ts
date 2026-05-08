const { PrismaClient } = require('../src/generated/prisma') as { PrismaClient: any };

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'shahdadkompanizare@gmail.com' },
    update: {},
    create: {
      email: 'shahdadkompanizare@gmail.com',
      name: 'Shahdad Kompanizare',
      company: 'Appfi (Scoli Inc.)',
      apiKey: 'sk_live_shahdad_swiftsign_2026',
    },
  });

  console.log('User created:', user.email);
  console.log('API Key:', user.apiKey);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
