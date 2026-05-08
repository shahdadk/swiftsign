// Send the DrillFit MSA + SOW bundle to Aidan via the production API.
// Two-signer routing: Shahdad (contractor) signs first, Aidan (client) signs second.

import fs from 'node:fs/promises'

const API_URL = 'https://swiftsign.ca'
const API_KEY = process.env.SWIFTSIGN_API_KEY ?? 'sk_live_shahdad_swiftsign_2026'

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

const fields = [
  // ============ MSA ============
  // -------- Contractor block (page 8) --------
  // signature on "By:" line — y=25.3% top of "By:" label
  { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 8, x: 17, y: 24, width: 35, height: 5 },
  // title on "Title:" line — y=29.8%
  { recipientIndex: 0, document: 0, type: 'TEXT',      page: 8, x: 17, y: 29, width: 40, height: 3.5 },
  // date on "Date:" line — y=36.4%
  { recipientIndex: 0, document: 0, type: 'DATE',      page: 8, x: 17, y: 35.5, width: 22, height: 3.5 },

  // -------- Client block (spans page 7 + 8) --------
  // signature on page 7, "By:" y=89.2%
  { recipientIndex: 1, document: 0, type: 'SIGNATURE', page: 7, x: 17, y: 88, width: 35, height: 5 },
  // name on page 8, "Name:" y=9.0%
  { recipientIndex: 1, document: 0, type: 'NAME',      page: 8, x: 19, y: 8.5, width: 40, height: 3.5 },
  // title on page 8, "Title:" y=11.3%
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 17, y: 10.8, width: 40, height: 3.5 },
  // email on page 8, "Email (Notices):" y=13.5%
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 26, y: 13.0, width: 40, height: 3.5 },
  // address on page 8, "Address:" y=15.7%
  { recipientIndex: 1, document: 0, type: 'TEXT',      page: 8, x: 22, y: 15.2, width: 55, height: 3.5 },
  // date on page 8, "Date:" y=17.9%
  { recipientIndex: 1, document: 0, type: 'DATE',      page: 8, x: 17, y: 17.4, width: 22, height: 3.5 },

  // ============ SOW (all on page 7) ============
  // -------- Contractor block --------
  // signature "By:" y=62.4%
  { recipientIndex: 0, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 61, width: 35, height: 5 },
  // title "Title:" y=66.9%
  { recipientIndex: 0, document: 1, type: 'TEXT',      page: 7, x: 17, y: 66.4, width: 40, height: 3.5 },
  // date "Date:" y=69.1%
  { recipientIndex: 0, document: 1, type: 'DATE',      page: 7, x: 17, y: 68.6, width: 22, height: 3.5 },

  // -------- Client block --------
  // signature "By:" y=48.9%
  { recipientIndex: 1, document: 1, type: 'SIGNATURE', page: 7, x: 17, y: 48, width: 35, height: 5 },
  // name "Name:" y=51.1%
  { recipientIndex: 1, document: 1, type: 'NAME',      page: 7, x: 19, y: 50.6, width: 40, height: 3.5 },
  // title "Title:" y=53.3%
  { recipientIndex: 1, document: 1, type: 'TEXT',      page: 7, x: 17, y: 52.8, width: 40, height: 3.5 },
  // date "Date:" y=55.5%
  { recipientIndex: 1, document: 1, type: 'DATE',      page: 7, x: 17, y: 55.0, width: 22, height: 3.5 },
]

const payload = {
  subject: 'DrillFit × Appfi — MSA + SOW',
  message:
    "Hey Aidan — please review and sign the MSA and SOW. Both are wrapped into one signing session. I'll have countersigned by the time you sign, so all you need to do is fill in your details on the client side. Thanks!",
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
