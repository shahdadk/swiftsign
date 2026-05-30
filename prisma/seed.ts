const { PrismaClient } = require('../src/generated/prisma') as { PrismaClient: any };
const nodeCrypto = require('crypto') as typeof import('crypto');

const prisma = new PrismaClient();

// Never hardcode a key. Use SWIFTSIGN_SEED_API_KEY if provided, else mint a
// random dev key (test-mode prefix) so a seeded DB is never a live credential.
const seedApiKey =
  process.env.SWIFTSIGN_SEED_API_KEY ??
  `sk_test_${nodeCrypto.randomBytes(16).toString('hex')}`;

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'shahdadkompanizare@gmail.com' },
    update: {},
    create: {
      email: 'shahdadkompanizare@gmail.com',
      name: 'Shahdad Kompanizare',
      company: 'Appfi (Scoli Inc.)',
      apiKey: seedApiKey,
    },
  });

  console.log('User created:', user.email);
  console.log('API Key:', user.apiKey);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
