// Local smoke test for the seal pipeline.
// Reads the DrillFit PDFs, builds canned signature data, runs sealDocument,
// writes output to /tmp/sealed-test-*.pdf for visual inspection.
//
// Run: npx tsx scripts/seal-smoke-test.ts

import fs from 'node:fs/promises'
import { sealDocument, type SealField } from '../src/lib/seal'

// A 1-line drawn-style signature PNG (small, from a manual capture)
// 240x70 px. Saved here as base64 so the test is self-contained.
const FAKE_SIGNATURE_PNG_B64 = (() => {
  // Generate a simple curvy signature programmatically using node-canvas-like API
  // Or hardcode a small PNG. Using a hardcoded "scribble" PNG.
  // This is a minimal 240x70 PNG with a black squiggle on transparent bg.
  // For the test we'll generate it on the fly:
  return null // computed below
})()

import { createCanvas } from '@napi-rs/canvas'
function makeFakeSignaturePng(text = 'Shahdad K.'): string {
  const canvas = createCanvas(400, 90)
  const ctx = canvas.getContext('2d')
  // transparent bg
  ctx.clearRect(0, 0, 400, 90)
  // signature stroke
  ctx.strokeStyle = '#0a0b0d'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.font = "italic 36px 'Georgia', 'Times New Roman', serif"
  ctx.fillStyle = '#0a0b0d'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 16, 50)
  // squiggle underline
  ctx.beginPath()
  ctx.moveTo(16, 78)
  for (let x = 16; x < 220; x += 12) {
    ctx.quadraticCurveTo(x + 6, 75, x + 12, 78)
  }
  ctx.stroke()
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
}

async function main() {
  const sigShahdad = makeFakeSignaturePng('Shahdad Kompanizare')
  const sigAidan = makeFakeSignaturePng('Aïdan Dizajï') // diacritics on purpose

  console.log(`Generated signature 1: ${sigShahdad.length} chars`)
  console.log(`Generated signature 2: ${sigAidan.length} chars`)

  const outDir = '/tmp/sealed-test'
  await fs.mkdir(outDir, { recursive: true })

  // ============ MSA: page 8 contractor + spans page 7-8 client ============
  const msaPath = '/tmp/maarijbaig-extract/DrillFit_MSA_2026-05-06.pdf'
  const msa = await fs.readFile(msaPath)

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Same coords as scripts/send-drillfit.mjs but with PAGE - 1 for sealDocument
  const msaFields: SealField[] = [
    // Contractor block (Shahdad) on page 8 (index 7)
    // "By:" label at y=25.3%, "Name:" label at y=27.5% → sig must fit between
    {
      type: 'SIGNATURE',
      page: 7,
      x: 17,
      y: 23.5,
      width: 35,
      height: 3,
      value: sigShahdad,
    },
    {
      type: 'TEXT',
      page: 7,
      x: 17,
      y: 28.5,
      width: 40,
      height: 3,
      value: 'Founder, Appfi (Scoli Inc.)',
    },
    { type: 'DATE', page: 7, x: 17, y: 35, width: 22, height: 3, value: today },

    // Client block (Aidan) — sig on page 7 (index 6), rest on page 8 (index 7)
    // Page 7 has plenty of space below (footer only) — can use slightly taller box
    {
      type: 'SIGNATURE',
      page: 6,
      x: 17,
      y: 87,
      width: 35,
      height: 3.5,
      value: sigAidan,
    },
    {
      type: 'NAME',
      page: 7,
      x: 19,
      y: 8,
      width: 40,
      height: 2.5,
      value: 'Aïdan Dizajï',
    },
    {
      type: 'TEXT',
      page: 7,
      x: 17,
      y: 10.3,
      width: 40,
      height: 2.5,
      value: 'CEO, DrillFit',
    },
    {
      type: 'TEXT',
      page: 7,
      x: 26,
      y: 12.5,
      width: 40,
      height: 2.5,
      value: 'aidan.dizaji@gmail.com',
    },
    {
      type: 'TEXT',
      page: 7,
      x: 22,
      y: 14.8,
      width: 55,
      height: 2.5,
      value: '123 Front St, Toronto, ON',
    },
    { type: 'DATE', page: 7, x: 17, y: 17, width: 22, height: 2.5, value: today },
  ]

  console.log(`\nSealing MSA with ${msaFields.length} fields...`)
  const msaOut = await sealDocument(msa, msaFields)
  await fs.writeFile(`${outDir}/MSA-sealed.pdf`, msaOut.sealedPdf)
  console.log(`  → ${outDir}/MSA-sealed.pdf (${msaOut.sealedPdf.length} bytes, sha256=${msaOut.documentHash.slice(0, 16)}…)`)

  // ============ SOW: all fields on page 7 ============
  const sowPath = '/tmp/maarijbaig-extract/DrillFit_SOW_2026-05-06.pdf'
  const sow = await fs.readFile(sowPath)

  const sowFields: SealField[] = [
    // Contractor block — By: y=62.4%, Name: y=64.7% → sig must fit between
    {
      type: 'SIGNATURE',
      page: 6,
      x: 17,
      y: 60.5,
      width: 35,
      height: 3,
      value: sigShahdad,
    },
    {
      type: 'TEXT',
      page: 6,
      x: 17,
      y: 65.8,
      width: 40,
      height: 2.5,
      value: 'Founder, Appfi (Scoli Inc.)',
    },
    {
      type: 'DATE',
      page: 6,
      x: 17,
      y: 68,
      width: 22,
      height: 2.5,
      value: today,
    },
    // Client block — By: y=48.9%, Name: y=51.1% → sig must fit between
    {
      type: 'SIGNATURE',
      page: 6,
      x: 17,
      y: 47,
      width: 35,
      height: 3,
      value: sigAidan,
    },
    {
      type: 'NAME',
      page: 6,
      x: 19,
      y: 50,
      width: 40,
      height: 2.5,
      value: 'Aïdan Dizajï',
    },
    {
      type: 'TEXT',
      page: 6,
      x: 17,
      y: 52.2,
      width: 40,
      height: 2.5,
      value: 'CEO, DrillFit',
    },
    {
      type: 'DATE',
      page: 6,
      x: 17,
      y: 54.4,
      width: 22,
      height: 2.5,
      value: today,
    },
  ]

  console.log(`\nSealing SOW with ${sowFields.length} fields...`)
  const sowOut = await sealDocument(sow, sowFields)
  await fs.writeFile(`${outDir}/SOW-sealed.pdf`, sowOut.sealedPdf)
  console.log(`  → ${outDir}/SOW-sealed.pdf (${sowOut.sealedPdf.length} bytes, sha256=${sowOut.documentHash.slice(0, 16)}…)`)

  console.log(`\n✓ Done. Open both with:`)
  console.log(`  open ${outDir}/MSA-sealed.pdf ${outDir}/SOW-sealed.pdf`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
