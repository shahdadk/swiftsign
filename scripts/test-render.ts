import { renderPdfToImages } from '../src/lib/pdf-renderer'
import fs from 'node:fs/promises'

async function main() {
  const pdf = await fs.readFile('/tmp/maarijbaig-extract/DrillFit_MSA_2026-05-06.pdf')
  const start = Date.now()
  const pages = await renderPdfToImages(pdf)
  console.log(`Rendered ${pages.length} pages in ${Date.now() - start}ms`)
  for (const p of pages) {
    console.log(`  page ${p.page}: ${p.width}x${p.height}, ${p.pngBuffer.length} bytes`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
