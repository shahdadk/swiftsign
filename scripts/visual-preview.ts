// Render a static "what Maarij will see" preview by drawing colored rectangles
// at each of his field positions, with labels. Read-only — never hits the
// signing API, never marks recipient as viewed, never auto-fills anything.
//
// Output: /tmp/preview/maarij-{MSA,SOW}-preview.pdf — opens automatically.

import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '../src/lib/db'

const ENVELOPE_ID = 'aa7c1e06-6f67-4b26-92b9-3ab4143fd754'

async function main() {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: ENVELOPE_ID },
    include: {
      documents: {
        orderBy: { order: 'asc' },
      },
      recipients: {
        where: { name: 'Maarij Baig' },
        include: {
          fields: { include: { document: { select: { id: true, name: true } } } },
        },
      },
    },
  })
  const maarij = env.recipients[0]
  if (!maarij) throw new Error("Couldn't find Maarij")

  const outDir = '/tmp/preview'
  await fs.mkdir(outDir, { recursive: true })

  // We don't need to download from R2 — we still have the original PDFs locally.
  const sourcePaths = {
    'DrillFit_MSA_2026-05-06.pdf':
      '/Users/shahdad/Downloads/maarijbaig/DrillFit_MSA_2026-05-06.pdf',
    'DrillFit_SOW_2026-05-06.pdf':
      '/Users/shahdad/Downloads/maarijbaig/DrillFit_SOW_2026-05-06.pdf',
  } as Record<string, string>

  const opened: string[] = []

  for (const doc of env.documents) {
    const path = sourcePaths[doc.name]
    if (!path) continue
    const pdfBytes = await fs.readFile(path)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const docFields = maarij.fields.filter((f) => f.documentId === doc.id)
    console.log(
      `\n${doc.name}: ${docFields.length} field${docFields.length === 1 ? '' : 's'} for Maarij`
    )

    for (const field of docFields) {
      const pageIndex = field.page - 1
      if (pageIndex < 0 || pageIndex >= pages.length) continue
      const page = pages[pageIndex]
      const w = page.getWidth()
      const h = page.getHeight()

      const absX = (field.x / 100) * w
      const absY = (field.y / 100) * h
      const absW = (field.width / 100) * w
      const absH = (field.height / 100) * h
      const boxBottomY = h - absY - absH

      // Amber semi-transparent fill matching the signing UI
      page.drawRectangle({
        x: absX,
        y: boxBottomY,
        width: absW,
        height: absH,
        color: rgb(0.99, 0.85, 0.3),
        opacity: 0.55,
        borderColor: rgb(0.85, 0.55, 0),
        borderWidth: 1,
      })

      // Label
      const label = humanLabel(field.type, doc.name, field.page, field.x, field.y)
      const labelSize = Math.max(6, Math.min(8, absH * 0.55))
      page.drawText(label, {
        x: absX + 2,
        y: boxBottomY + Math.max(2, absH * 0.25),
        size: labelSize,
        font: helv,
        color: rgb(0.4, 0.25, 0),
      })

      console.log(
        `  • [${field.type}] page ${field.page} @ x=${field.x}% y=${field.y}% — ${label}`
      )
    }

    const out = `${outDir}/${doc.name.replace('.pdf', '-preview.pdf')}`
    await fs.writeFile(out, await pdfDoc.save())
    console.log(`  → ${out}`)
    opened.push(out)
  }

  if (opened.length > 0) {
    console.log(`\nOpening: open ${opened.join(' ')}`)
    spawn('open', opened, { stdio: 'inherit' })
  }
}

// Friendly label for what the recipient is meant to fill in based on
// type + position context (we know the DrillFit layout).
function humanLabel(type: string, docName: string, page: number, x: number, y: number): string {
  if (type === 'SIGNATURE') return 'Sign here'
  if (type === 'NAME') return 'Your full name'
  if (type === 'DATE') return 'Date'
  if (type === 'INITIALS') return 'Initials'
  if (type === 'CHECKBOX') return 'Check'
  // TEXT — disambiguate by both x and y on MSA page 1
  if (docName.startsWith('DrillFit_MSA') && page === 1) {
    if (y < 22) return 'Effective Date (e.g. May 8, 2026)'
    if (x < 50) return 'Client Legal Name (e.g. DrillFit Inc.)'
    return 'Client Address'
  }
  if (docName.startsWith('DrillFit_MSA') && page === 8) {
    if (y < 11) return 'Title (e.g. CEO)'
    if (y < 13.5) return 'Email (Notices)'
    if (y < 16) return 'Address'
  }
  if (docName.startsWith('DrillFit_SOW') && page === 7) {
    if (y > 50 && y < 53) return 'Title'
  }
  return 'Text field'
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
