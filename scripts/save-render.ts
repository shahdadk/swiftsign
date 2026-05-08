import fs from 'node:fs/promises'
import { renderPdfToImages } from '../src/lib/pdf-renderer'

async function main() {
  const pdf = await fs.readFile('/tmp/maarijbaig-extract/DrillFit_MSA_2026-05-06.pdf')
  const pages = await renderPdfToImages(pdf, 2)
  await fs.writeFile('/tmp/page1.png', pages[0].pngBuffer)
  console.log('Saved page 1:', pages[0].pngBuffer.length, 'bytes')
  console.log('Saved page 7:', pages[6].pngBuffer.length, 'bytes')
  await fs.writeFile('/tmp/page7.png', pages[6].pngBuffer)
}
main().catch((e) => { console.error(e); process.exit(1) })
