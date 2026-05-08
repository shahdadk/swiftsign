// Pull sealed PDFs + certificate for a completed envelope and open them.
// Run: npx tsx --env-file=.env.local scripts/smoke-test-pull.ts <envelopeId>

import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { prisma } from '../src/lib/db'
import { downloadPdf } from '../src/lib/storage'

async function main() {
  const envelopeId = process.argv[2]
  if (!envelopeId) {
    console.error('Usage: smoke-test-pull.ts <envelopeId>')
    process.exit(1)
  }

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      documents: { orderBy: { order: 'asc' } },
      recipients: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  })

  console.log(`\nEnvelope: ${envelope.subject}`)
  console.log(`Status:   ${envelope.status}`)
  console.log(`Created:  ${envelope.createdAt.toISOString()}`)
  console.log(`Completed:${envelope.completedAt?.toISOString() ?? 'pending'}`)
  console.log(`\nRecipients:`)
  for (const r of envelope.recipients) {
    console.log(`  • [${r.status}] ${r.name} <${r.email}> · order=${r.routingOrder} · signed=${r.signedAt?.toISOString() ?? '—'}`)
  }

  console.log(`\nAudit log (${envelope.auditLogs.length} entries):`)
  for (const log of envelope.auditLogs) {
    console.log(`  · ${log.createdAt.toISOString()} ${log.event} ${log.actorEmail ?? ''}`)
  }

  if (envelope.status !== 'COMPLETED') {
    console.log(`\n⚠ Envelope is not COMPLETED yet — sealed PDFs may not exist.`)
    console.log(`  Sign at: https://swiftsign.ca/sign/<token> for each pending signer.`)
    process.exit(0)
  }

  const outDir = `/tmp/smoke-out/${envelopeId}`
  await fs.mkdir(outDir, { recursive: true })

  const opened: string[] = []

  for (const doc of envelope.documents) {
    if (!doc.signedKey) {
      console.log(`  ⚠ ${doc.name}: no signedKey — skipping`)
      continue
    }
    const pdf = await downloadPdf(doc.signedKey)
    const path = `${outDir}/${doc.name.replace(/\s+/g, '_')}`
    await fs.writeFile(path, pdf)
    console.log(`  ✓ ${doc.name} → ${path} (${pdf.length} bytes, sha256=${doc.documentHash?.slice(0, 16) ?? 'none'}…)`)
    opened.push(path)
  }

  const certKey = `certificates/${envelopeId}/certificate.pdf`
  try {
    const cert = await downloadPdf(certKey)
    const certPath = `${outDir}/certificate.pdf`
    await fs.writeFile(certPath, cert)
    console.log(`  ✓ Certificate → ${certPath} (${cert.length} bytes)`)
    opened.push(certPath)
  } catch (err) {
    console.log(`  ✗ Certificate not found at ${certKey}: ${err instanceof Error ? err.message : err}`)
  }

  if (opened.length > 0) {
    console.log(`\nOpening: open ${opened.join(' ')}`)
    spawn('open', opened, { stdio: 'inherit' })
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
