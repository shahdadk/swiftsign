// Send the Appfi × ItemIQ Subcontractor Services Agreement to Saad Khan.
// Single-signer envelope — Shahdad's signature is already baked into the PDF
// from a prior DocuSign session (3/25/2026), so this just collects the
// Prime Contractor (ItemIQ Inc. / Saad Khan) countersignature.
//
// Run: node scripts/send-saad.mjs

import fs from 'node:fs/promises'

const API_URL = 'https://swiftsign.ca'
const API_KEY = process.env.SWIFTSIGN_API_KEY
if (!API_KEY) {
  console.error('SWIFTSIGN_API_KEY env var is required')
  process.exit(1)
}

const PDF_PATH =
  '/Users/shahdad/Downloads/Appfi_ItemIQ_Subcontractor_Agreement.docx.pdf'

const pdfB64 = (await fs.readFile(PDF_PATH)).toString('base64')
console.log(`PDF: ${(pdfB64.length / 1024).toFixed(0)}KB base64`)

// Prime Contractor (ItemIQ / Saad) signature block on page 10.
// bbox-verified label positions:
//   Signature: y=48.7%   |   Name: y=51.5%
//   Title:     y=54.4%   |   Email (Notices): y=57.2%
//   Date:      y=60.1%
// Field box top is ~1.2% above each label so the underline sits inside the box.
const fields = [
  { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 10, x: 22, y: 47.5, width: 35, height: 3 },
  { recipientIndex: 0, document: 0, type: 'NAME',      page: 10, x: 19, y: 50.5, width: 40, height: 2.5 },
  { recipientIndex: 0, document: 0, type: 'TEXT',      page: 10, x: 17, y: 53.4, width: 40, height: 2.5 },
  { recipientIndex: 0, document: 0, type: 'TEXT',      page: 10, x: 26, y: 56.2, width: 45, height: 2.5 },
  { recipientIndex: 0, document: 0, type: 'DATE',      page: 10, x: 17, y: 59.1, width: 22, height: 2.5 },
]

const payload = {
  subject: 'Appfi × ItemIQ — Subcontractor Services Agreement',
  message:
    'Hi Saad — please countersign the Subcontractor Services Agreement. Appfi has already signed the subcontractor side; you just need to fill out the Prime Contractor block on the last page (signature, name, title, email, date). Reach out if anything looks off.',
  documents: [
    {
      name: 'Appfi_ItemIQ_Subcontractor_Agreement.pdf',
      base64: pdfB64,
    },
  ],
  recipients: [
    {
      name: 'Saad Khan',
      email: 'saad.khan.eng@gmail.com',
      role: 'SIGNER',
      routingOrder: 1,
    },
  ],
  fields,
}

console.log(`\nPayload:`)
console.log(`  Subject: ${payload.subject}`)
console.log(`  Recipient: ${payload.recipients[0].name} <${payload.recipients[0].email}>`)
console.log(`  Fields: ${fields.length} (all on page 10 — Prime Contractor block)`)
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

console.log(`✓ Sent\n`)
console.log(`→ saad.khan.eng@gmail.com should have an email shortly.`)
console.log(`Dashboard: ${API_URL}/dashboard/${created.id}`)
