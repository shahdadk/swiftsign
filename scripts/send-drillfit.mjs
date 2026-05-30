// Send the DrillFit MSA + SOW bundle to Aidan via the production API.
// Two-signer routing: Shahdad (contractor) signs first, Aidan (client) signs second.

import fs from 'node:fs/promises'

const API_URL = 'https://swiftsign.ca'
const API_KEY = process.env.SWIFTSIGN_API_KEY
if (!API_KEY) {
  console.error('SWIFTSIGN_API_KEY env var is required')
  process.exit(1)
}

const MSA_PATH = '/tmp/maarijbaig-extract/DrillFit_MSA_2026-05-06.pdf'
const SOW_PATH = '/tmp/maarijbaig-extract/DrillFit_SOW_2026-05-06.pdf'

const msaB64 = (await fs.readFile(MSA_PATH)).toString('base64')
const sowB64 = (await fs.readFile(SOW_PATH)).toString('base64')

console.log(`MSA: ${(msaB64.length / 1024).toFixed(0)}KB base64`)
console.log(`SOW: ${(sowB64.length / 1024).toFixed(0)}KB base64`)

// Recipient indexes:
//   0 = Shahdad (contractor) — routingOrder 1, signs first
//   1 = Aidan (client)        — routingOrder 2, signs second

// Document indexes:
//   0 = MSA
//   1 = SOW

// Tightened coords (verified via scripts/seal-smoke-test.ts).
// Signature box must fit in the gap between "By:" line and "Name:" label
// to avoid overlap on the sealed PDF.
const fields = [
  // ============ MSA ============
  // -------- Contractor block (page 8) --------
  { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 8, x: 17, y: 23.5, width: 35, height: 3 },
  { recipientIndex: 0, document: 0, type: 'TEXT',      page: 8, x: 17, y: 28.5, width: 40, height: 3 },
  { recipientIndex: 0, document: 0, type: 'DATE',      page: 8, x: 17, y: 35,   width: 22, height: 3 },

  // -------- Client block (spans page 7 + 8) --------
  { recipientIndex: 1, document: 0, type: 'SIGNATURE', page: 7, x: 17, y: 87,   width: 35, height: 3.5 },
  { recipientIndex: 1, document: 0, type: 'NAME',      page: 8, x: 19, y: 8,    width: 40, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 17, y: 10.3, width: 40, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 26, y: 12.5, width: 50, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 22, y: 14.8, width: 55, height: 2.5 },
  { recipientIndex: 1, document: 0, type: 'DATE',      page: 8, x: 17, y: 17,   width: 22, height: 2.5 },

  // ============ SOW (all on page 7) ============
  // -------- Contractor block --------
  { recipientIndex: 0, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 60.5, width: 35, height: 3 },
  { recipientIndex: 0, document: 1, type: 'TEXT',      page: 7, x: 17, y: 65.8, width: 40, height: 2.5 },
  { recipientIndex: 0, document: 1, type: 'DATE',      page: 7, x: 17, y: 68,   width: 22, height: 2.5 },

  // -------- Client block --------
  { recipientIndex: 1, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 47,   width: 35, height: 3 },
  { recipientIndex: 1, document: 1, type: 'NAME',      page: 7, x: 19, y: 50,   width: 40, height: 2.5 },
  { recipientIndex: 1, document: 1, type: 'TEXT',      page: 7, x: 17, y: 52.2, width: 40, height: 2.5 },
  { recipientIndex: 1, document: 1, type: 'DATE',      page: 7, x: 17, y: 54.4, width: 22, height: 2.5 },
]

const payload = {
  subject: 'DrillFit × Appfi — MSA + SOW',
  message:
    "MSA and SOW for the DrillFit engagement. Both are bundled into one signing session — please review, sign the highlighted fields, and submit. Thanks!",
  documents: [
    { name: 'DrillFit_MSA_2026-05-06.pdf', base64: msaB64 },
    { name: 'DrillFit_SOW_2026-05-06.pdf', base64: sowB64 },
  ],
  recipients: [
    {
      name: 'Shahdad Kompanizare',
      email: 'shahdadkompanizare@gmail.com',
      role: 'SIGNER',
      routingOrder: 1,
    },
    {
      name: 'Aidan Dizaji',
      email: 'aidan.dizaji@gmail.com',
      role: 'SIGNER',
      routingOrder: 2,
    },
  ],
  fields,
}

console.log(`\nPosting envelope (${fields.length} fields, 2 docs, 2 signers)...`)

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

console.log(`\n✓ Envelope created: ${created.id}`)
console.log(`  Status: ${created.status}`)
console.log(`  Documents: ${created.documents.length}`)
console.log(`  Recipients: ${created.recipients.length}`)
console.log()
for (const r of created.recipients) {
  console.log(`  • ${r.name} <${r.email}> [order=${r.routingOrder}, status=${r.status}]`)
}

console.log(`\nNow triggering send...`)
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

console.log(`✓ Sent: ${JSON.stringify(sent)}`)
console.log(`\nEnvelope dashboard: ${API_URL}/dashboard/${created.id}`)
console.log(`First signer (Shahdad) should have an email with their sign link now.`)
