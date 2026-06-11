// Local UX-test harness: builds a 2-page test agreement with pdf-lib (text
// placed deliberately close under the signature line so opaque signature
// backgrounds are visible), creates an envelope via the LOCAL dev API, and
// prints the signing URL.
//
// Run: SWIFTSIGN_API_KEY=... npx tsx scripts/ux-test-envelope.ts [recipientEmail]
// Requires `npm run dev` on port 3000.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '../src/lib/db'

const API_URL = process.env.UX_TEST_API_URL ?? 'http://localhost:3000'
const API_KEY = process.env.SWIFTSIGN_API_KEY
const RECIPIENT_EMAIL = process.argv[2] ?? 'shahdadkompanizare@gmail.com'

if (!API_KEY) {
  console.error('SWIFTSIGN_API_KEY env var is required')
  process.exit(1)
}

async function buildTestPdf(): Promise<string> {
  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ---- Page 1: dense terms + initials line bottom-right ----
  const p1 = doc.addPage([612, 792])
  p1.drawText('SWIFTSIGN UX TEST AGREEMENT', { x: 72, y: 720, size: 16, font: bold })
  p1.drawText('This document exists to exercise the signer experience. Not a real agreement.', {
    x: 72, y: 696, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4),
  })
  const para =
    'The parties agree that the signature applied to this document must sit cleanly on the ' +
    'signature line without an opaque background box covering the line itself or any text ' +
    'near it. Dense paragraph text continues here to simulate a real contract body. '
  let y = 660
  for (let i = 0; i < 14; i++) {
    p1.drawText(`${i + 1}. ${para}`, { x: 72, y, size: 9, font: helvetica, maxWidth: 468, lineHeight: 12 })
    y -= 40
  }
  // Initials line bottom-right, with text directly beneath it
  p1.drawLine({ start: { x: 460, y: 80 }, end: { x: 540, y: 80 }, thickness: 1, color: rgb(0, 0, 0) })
  p1.drawText('Initials of Recipient', { x: 460, y: 68, size: 8, font: helvetica })

  // ---- Page 2: signature block with text tight under the line ----
  const p2 = doc.addPage([612, 792])
  p2.drawText('EXECUTION', { x: 72, y: 720, size: 14, font: bold })
  p2.drawText('IN WITNESS WHEREOF, the parties have executed this Agreement as of the date below.', {
    x: 72, y: 696, size: 10, font: helvetica, maxWidth: 468,
  })

  // Signature line at y=540 (pdf coords, bottom-left origin)
  p2.drawText('Signature:', { x: 72, y: 545, size: 10, font: bold })
  p2.drawLine({ start: { x: 140, y: 540 }, end: { x: 360, y: 540 }, thickness: 1, color: rgb(0, 0, 0) })
  // Text TIGHT under the line — an opaque signature background covers this
  p2.drawText('Shahdad Kompanizare, Authorized Signatory', { x: 140, y: 528, size: 9, font: helvetica })
  p2.drawText('(sign above this line; the line and this text must stay visible)', {
    x: 140, y: 516, size: 8, font: helvetica, color: rgb(0.45, 0.45, 0.45),
  })

  // Name line with a bracket placeholder the NAME field should redact
  p2.drawText('Name:', { x: 72, y: 475, size: 10, font: bold })
  p2.drawLine({ start: { x: 140, y: 470 }, end: { x: 360, y: 470 }, thickness: 1, color: rgb(0, 0, 0) })
  p2.drawText('[FULL LEGAL NAME]', { x: 144, y: 474, size: 9, font: helvetica, color: rgb(0.55, 0.55, 0.55) })

  // Date line
  p2.drawText('Date:', { x: 72, y: 435, size: 10, font: bold })
  p2.drawLine({ start: { x: 140, y: 430 }, end: { x: 280, y: 430 }, thickness: 1, color: rgb(0, 0, 0) })

  const bytes = await doc.save()
  return Buffer.from(bytes).toString('base64')
}

async function main() {
  const base64 = await buildTestPdf()

  // Page dims 612x792. Percent coords, top-left origin, 1-indexed pages.
  // Signature line on p2 is at pdf y=540 -> top-origin y = (792-540)/792 = 31.8%.
  // Field bottom should land on the line: y + height = 31.8.
  const fields = [
    // Initials, page 1: line at pdf y=80 -> top y = (792-80)/792 = 89.9%
    { recipientIndex: 0, document: 0, type: 'INITIALS', page: 1, x: 74.5, y: 84.9, width: 14, height: 5, required: true },
    // Signature, page 2: bottom at 31.8%, height 5.5% -> y = 26.3
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 2, x: 22.5, y: 26.3, width: 36, height: 5.5, required: true },
    // Name, page 2: line at pdf y=470 -> bottom 40.66%, h 2.8 -> y = 37.86
    { recipientIndex: 0, document: 0, type: 'NAME', page: 2, x: 22.5, y: 37.86, width: 36, height: 2.8, required: true },
    // Date, page 2: line at pdf y=430 -> bottom 45.7%, h 2.8 -> y = 42.9
    { recipientIndex: 0, document: 0, type: 'DATE', page: 2, x: 22.5, y: 42.9, width: 23, height: 2.8, required: true },
  ]

  const res = await fetch(`${API_URL}/api/v1/envelopes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      subject: 'SwiftSign UX test - ignore',
      message: 'Internal signer-UX test envelope. Safe to ignore.',
      documents: [{ name: 'UX_Test_Agreement.pdf', base64 }],
      recipients: [{ name: 'Shahdad Kompanizare', email: RECIPIENT_EMAIL }],
      fields,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`Envelope create failed (${res.status}):`, JSON.stringify(body, null, 2))
    process.exit(1)
  }

  const envelopeId: string = body.id ?? body.envelopeId
  console.log(`envelope: ${envelopeId}`)

  // Envelopes are created as DRAFT; dispatch to the signer.
  const sendRes = await fetch(`${API_URL}/api/v1/envelopes/${envelopeId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ action: 'send' }),
  })
  if (!sendRes.ok) {
    console.error(`send action failed (${sendRes.status}):`, await sendRes.text())
    process.exit(1)
  }

  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: { recipients: { select: { name: true, signingToken: true, status: true } } },
  })
  for (const r of env.recipients) {
    console.log(`${r.name} [${r.status}]: ${API_URL}/sign/${r.signingToken}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
