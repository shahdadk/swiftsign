// Send the DrillFit MSA + SOW contract to Maarij Baig.
// Routing order: Shahdad signs first as contractor, then Maarij as client.
//
// Run: node scripts/send-maarij.mjs

import fs from 'node:fs/promises'

const API_URL = 'https://swiftsign.ca'
const API_KEY = process.env.SWIFTSIGN_API_KEY ?? 'sk_live_shahdad_swiftsign_2026'

const MSA_PATH = '/Users/shahdad/Downloads/maarijbaig/DrillFit_MSA_2026-05-06.pdf'
const SOW_PATH = '/Users/shahdad/Downloads/maarijbaig/DrillFit_SOW_2026-05-06.pdf'

const msaB64 = (await fs.readFile(MSA_PATH)).toString('base64')
const sowB64 = (await fs.readFile(SOW_PATH)).toString('base64')

console.log(`MSA: ${(msaB64.length / 1024).toFixed(0)}KB base64`)
console.log(`SOW: ${(sowB64.length / 1024).toFixed(0)}KB base64`)

// Field positions verified end-to-end via scripts/seal-smoke-test.ts.
// Heights are tight (3% for sigs, 2.5% for text) so signature box doesn't
// overlap "Name:" pre-printed label below.
const fields = [
  // ============ MSA ============
  // Contractor block on page 8 (Shahdad)
  { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 8, x: 17, y: 23.5, width: 35, height: 3 },
  { recipientIndex: 0, document: 0, type: 'TEXT',      page: 8, x: 17, y: 28.5, width: 40, height: 3 },
  { recipientIndex: 0, document: 0, type: 'DATE',      page: 8, x: 17, y: 35,   width: 22, height: 3 },
  // Client block (Maarij) — sig on page 7, rest on page 8
  { recipientIndex: 1, document: 0, type: 'SIGNATURE', page: 7, x: 17, y: 87,   width: 35, height: 3.5 },
  { recipientIndex: 1, document: 0, type: 'NAME',      page: 8, x: 19, y: 8,    width: 40, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 17, y: 10.3, width: 40, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 26, y: 12.5, width: 50, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 22, y: 14.8, width: 55, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'DATE',      page: 8, x: 17, y: 17,   width: 22, height: 2.5 },

  // ============ SOW (all on page 7) ============
  // Contractor block (Shahdad)
  { recipientIndex: 0, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 60.5, width: 35, height: 3 },
  { recipientIndex: 0, document: 1, type: 'TEXT',      page: 7, x: 17, y: 65.8, width: 40, height: 2.5 },
  { recipientIndex: 0, document: 1, type: 'DATE',      page: 7, x: 17, y: 68,   width: 22, height: 2.5 },
  // Client block (Maarij)
  { recipientIndex: 1, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 47,   width: 35, height: 3 },
  { recipientIndex: 1, document: 1, type: 'NAME',      page: 7, x: 19, y: 50,   width: 40, height: 2.5 },
  { recipientIndex: 1, document: 1, type: 'TEXT',      page: 7, x: 17, y: 52.2, width: 40, height: 2.5 },
  { recipientIndex: 1, document: 1, type: 'DATE',      page: 7, x: 17, y: 54.4, width: 22, height: 2.5 },
]

const payload = {
  subject: 'DrillFit × Appfi — Master Services Agreement + Statement of Work',
  message:
    "Hi — please review and countersign the MSA and SOW. Both documents are bundled into one signing session: Shahdad will sign first as contractor, then it routes to you for the client signature, name, title, email, and address. Reach out if anything looks off before signing.",
  documents: [
    { name: 'DrillFit_MSA_2026-05-06.pdf', base64: msaB64 },
    { name: 'DrillFit_SOW_2026-05-06.pdf', base64: sowB64 },
  ],
  recipients: [
    {
      name: 'Shahdad Kompanizare',
      email: 'shahdad@appfi.dev',
      role: 'SIGNER',
      routingOrder: 1,
    },
    {
      name: 'Maarij Baig',
      email: 'maarijbaig7@gmail.com',
      role: 'SIGNER',
      routingOrder: 2,
    },
  ],
  fields,
}

console.log(`\nPayload check:`)
console.log(`  Subject:  ${payload.subject}`)
console.log(`  Signer 1: ${payload.recipients[0].name} <${payload.recipients[0].email}>`)
console.log(`  Signer 2: ${payload.recipients[1].name} <${payload.recipients[1].email}>`)
console.log(`  Documents:`)
for (const d of payload.documents) console.log(`    - ${d.name}`)
console.log(`  Fields: ${fields.length}`)
console.log()

const createRes = await fetch(`${API_URL}/api/v1/envelopes`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})

const created = await createRes.json()
if (!createRes.ok) {
  console.error('CREATE FAILED:', createRes.status, JSON.stringify(created, null, 2))
  process.exit(1)
}

console.log(`✓ Envelope created: ${created.id}`)
for (const r of created.recipients) {
  console.log(`  • ${r.name} <${r.email}> [order=${r.routingOrder}, status=${r.status}]`)
}

const sendRes = await fetch(`${API_URL}/api/v1/envelopes/${created.id}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'send' }),
})

const sent = await sendRes.json()
if (!sendRes.ok) {
  console.error('SEND FAILED:', sendRes.status, JSON.stringify(sent, null, 2))
  process.exit(1)
}

console.log(`\n✓ Sent`)
console.log(`\n→ shahdad@appfi.dev should now have an email with the sign link.`)
console.log(`  After you sign, Maarij gets his email automatically.`)
console.log(`\nEnvelope dashboard: ${API_URL}/dashboard/${created.id}`)
