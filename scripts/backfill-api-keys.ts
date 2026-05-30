import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { hashApiKey, DEFAULT_SCOPES } from '../src/lib/api-key'

// One-time backfill: migrate every legacy plaintext User.apiKey into a hashed
// ApiKey row so existing keys (Shahdad's, the MCP's, any client's) keep
// authenticating after the cutover. Idempotent — safe to re-run. Run manually
// against prod at deploy: `npx tsx scripts/backfill-api-keys.ts`.
async function main() {
  const users = await prisma.user.findMany({ where: { apiKey: { not: null } } })
  let created = 0
  let skipped = 0
  for (const u of users) {
    const key = u.apiKey
    if (!key) continue
    const hashedKey = hashApiKey(key)
    const exists = await prisma.apiKey.findUnique({ where: { hashedKey } })
    if (exists) {
      skipped++
      continue
    }
    const mode = key.startsWith('sk_test_') ? 'TEST' : 'LIVE'
    await prisma.apiKey.create({
      data: {
        userId: u.id,
        name: 'Migrated',
        hashedKey,
        prefix: key.slice(0, 16),
        last4: key.slice(-4),
        mode,
        scopes: DEFAULT_SCOPES,
      },
    })
    created++
  }
  console.log(`Backfill complete: ${created} created, ${skipped} skipped`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
