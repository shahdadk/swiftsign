// Repro: simulates the route handler's sequence
//   1. read PDF buffer (the docBuffersPre[i] path)
//   2. upload + renderPdfToImages(buffer)
//   3. findAnchorPosition(buffer, "sigfield_...")
//
// Run from products/swiftsign/:
//   npx tsx scripts/repro-anchor-bug.ts <pdf-path>

import fs from 'node:fs/promises'
import { renderPdfToImages, findAnchorPosition } from '../src/lib/pdf-renderer'

const PDF_PATH = process.argv[2] ?? '/Users/shahdad/Documents/Claude/Projects/Appfi/itemiq/contracts/Appfi_SaadKhan_Subcontractor_Agreement_2026-05-22.pdf'

const ANCHORS = [
  'sigfield_prime_signature',
  'sigfield_prime_name',
  'sigfield_prime_title',
  'sigfield_prime_email',
  'sigfield_prime_date',
]

// Same shape route.ts handles. f.page=-1 means anchor mode.
type Field = {
  recipientIndex: number
  document: number
  type: string
  page: number
  x: number
  y: number
  width?: number
  height?: number
  anchor?: string
  yOffset?: number
}

async function main() {
  // Simulate the base64 round-trip (what the route does)
  const raw = await fs.readFile(PDF_PATH)
  const base64 = raw.toString('base64')

  // === SIMULATE ROUTE HANDLER ===
  // Phase 0: Buffer.from(doc.base64, 'base64')
  const buffer = Buffer.from(base64, 'base64')
  const docBuffers: Buffer[] = [buffer]
  console.log(`buffer.byteLength=${buffer.byteLength}, base64 length=${base64.length}`)

  // Phase 1: render PDF to images (simulates uploadPdf + renderPdfToImages)
  console.log('Rendering PDF to images...')
  const pages = await renderPdfToImages(buffer)
  console.log(`Rendered ${pages.length} pages\n`)

  // Phase 1.5: anchor resolution (this is where the bug should manifest)
  const fields: Field[] = ANCHORS.map((anchor, i) => ({
    recipientIndex: 0,
    document: 0,
    type: i === 0 ? 'SIGNATURE' : 'TEXT',
    page: -1, // anchor mode
    x: 0,
    y: 0,
    anchor,
  }))

  console.log('Resolving anchors via Promise.all (same as route)...')
  const resolved = await Promise.all(fields.map(async (f) => {
    let page = f.page
    let x = f.x
    let y = f.y

    if (f.anchor && docBuffers[f.document]) {
      try {
        const pos = await findAnchorPosition(docBuffers[f.document], f.anchor)
        if (pos) {
          page = pos.page
          x = f.x || (pos.x + 8)
          y = pos.y + (f.yOffset ?? -2)
          console.log(`  ✓ ${f.anchor} → page=${page} x=${x.toFixed(2)} y=${y.toFixed(2)}`)
        } else {
          console.log(`  ✗ ${f.anchor} → pos NULL (anchor not found)`)
        }
      } catch (anchorErr) {
        console.log(`  ✗ ${f.anchor} → threw: ${(anchorErr as Error).message}`)
      }
    } else {
      console.log(`  ✗ ${f.anchor} → skipped (anchor=${!!f.anchor}, buffer=${!!docBuffers[f.document]})`)
    }

    return { ...f, page: page < 1 ? 1 : page, x, y }
  }))

  console.log('\nResolved fields:')
  for (const f of resolved) {
    console.log(`  ${f.anchor}: page=${f.page} x=${f.x.toFixed(2)} y=${f.y.toFixed(2)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
