// Test the route handler's new anchor-resolution logic in isolation.
//
// Verifies:
//   1. Anchored fields resolve to the correct (page, x, y) using a SHARED
//      text-positions extraction per document.
//   2. Fields with no anchor pass through unchanged.
//   3. Missing anchors surface as an unresolvedAnchors entry.
//   4. The double-pass (per-doc extract, then per-field resolve) matches what
//      the old per-field findAnchorPosition call returned.
//
// Run from products/swiftsign/:
//   npx tsx scripts/test-anchor-resolution.ts

import fs from 'node:fs/promises'
import {
  extractTextPositions,
  findAnchorPosition,
  type TextPosition,
  type AnchorResult,
} from '../src/lib/pdf-renderer'

const PDF_PATH =
  process.argv[2] ??
  '/Users/shahdad/Documents/Claude/Projects/Appfi/itemiq/contracts/Appfi_SaadKhan_Subcontractor_Agreement_2026-05-22.pdf'

const ANCHORS = [
  'sigfield_prime_signature',
  'sigfield_prime_name',
  'sigfield_prime_title',
  'sigfield_prime_email',
  'sigfield_prime_date',
]

// Local copy of the route handler's resolveAnchor — identical algorithm.
function resolveAnchor(
  positions: TextPosition[],
  anchor: string,
): AnchorResult | null {
  const needle = anchor.toLowerCase()
  let lastMatch: AnchorResult | null = null
  for (const pos of positions) {
    if (pos.text.toLowerCase().includes(needle)) {
      lastMatch = {
        page: pos.page,
        x: pos.x,
        y: pos.y,
        xEnd: pos.x + pos.width,
      }
    }
  }
  return lastMatch
}

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

function processFields(
  fields: Field[],
  docTextPositions: Map<number, TextPosition[]>,
  docExtractionErrors: Map<number, string>,
) {
  const unresolvedAnchors: Array<{ anchor: string; document: number; reason: string }> = []
  const resolvedFields = fields.map((f) => {
    let page = f.page
    let x = f.x
    let y = f.y

    if (f.anchor && f.anchor.length > 0) {
      const positions = docTextPositions.get(f.document)
      if (!positions) {
        unresolvedAnchors.push({
          anchor: f.anchor,
          document: f.document,
          reason:
            docExtractionErrors.get(f.document) ??
            'no text positions extracted for document',
        })
      } else {
        const pos = resolveAnchor(positions, f.anchor)
        if (pos) {
          page = pos.page
          x = f.x || pos.x + 8
          y = pos.y + (f.yOffset ?? -2)
        } else {
          unresolvedAnchors.push({
            anchor: f.anchor,
            document: f.document,
            reason: 'anchor text not found in document',
          })
        }
      }
    }

    return { ...f, page: page < 1 ? 1 : page, x, y }
  })

  return { resolvedFields, unresolvedAnchors }
}

let exitCode = 0
function assertEq<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    console.log(`    expected: ${JSON.stringify(expected)}`)
    exitCode = 1
  }
}

async function main() {
  const buffer = await fs.readFile(PDF_PATH)

  console.log('--- Case 1: all anchors resolve, no explicit coords ---')
  const positions = await extractTextPositions(buffer)
  const docTextPositions = new Map<number, TextPosition[]>([[0, positions]])
  const docExtractionErrors = new Map<number, string>()

  const fields1: Field[] = ANCHORS.map((anchor, i) => ({
    recipientIndex: 0,
    document: 0,
    type: i === 0 ? 'SIGNATURE' : 'TEXT',
    page: -1,
    x: 0,
    y: 0,
    anchor,
  }))

  const res1 = processFields(fields1, docTextPositions, docExtractionErrors)
  assertEq(res1.unresolvedAnchors.length, 0, 'all anchors resolved')
  console.log('  resolved fields:')
  for (const f of res1.resolvedFields) {
    console.log(`    ${f.anchor}: page=${f.page} x=${f.x.toFixed(2)} y=${f.y.toFixed(2)}`)
  }
  // signature anchor on page 10 at x≈74.1, y≈19.7 → resolved x ≈ 82.1, y ≈ 17.7
  assertEq(res1.resolvedFields[0].page, 10, 'signature on page 10')
  assertEq(
    Math.round(res1.resolvedFields[0].x * 10) / 10,
    Math.round((74.1 + 8) * 10) / 10,
    'signature x ≈ 82.1',
  )
  assertEq(
    Math.round(res1.resolvedFields[0].y * 10) / 10,
    Math.round((19.7 - 2) * 10) / 10,
    'signature y ≈ 17.7',
  )

  console.log()
  console.log('--- Case 2: pass-through field (no anchor, explicit coords) ---')
  const fields2: Field[] = [
    {
      recipientIndex: 0,
      document: 0,
      type: 'DATE',
      page: 3,
      x: 50,
      y: 60,
    },
  ]
  const res2 = processFields(fields2, new Map(), new Map())
  assertEq(res2.unresolvedAnchors.length, 0, 'no unresolved anchors')
  assertEq(res2.resolvedFields[0].page, 3, 'pass-through page=3')
  assertEq(res2.resolvedFields[0].x, 50, 'pass-through x=50')
  assertEq(res2.resolvedFields[0].y, 60, 'pass-through y=60')

  console.log()
  console.log('--- Case 3: unknown anchor surfaces as unresolved ---')
  const fields3: Field[] = [
    {
      recipientIndex: 0,
      document: 0,
      type: 'SIGNATURE',
      page: -1,
      x: 0,
      y: 0,
      anchor: 'this_anchor_does_not_exist_xyz',
    },
  ]
  const res3 = processFields(fields3, docTextPositions, docExtractionErrors)
  assertEq(res3.unresolvedAnchors.length, 1, 'one unresolved anchor')
  assertEq(
    res3.unresolvedAnchors[0].anchor,
    'this_anchor_does_not_exist_xyz',
    'anchor name preserved',
  )

  console.log()
  console.log('--- Case 4: doc-level extraction failure surfaces ---')
  const errMap = new Map<number, string>([[0, 'PDF parse error: boom']])
  const res4 = processFields(fields1, new Map(), errMap)
  assertEq(res4.unresolvedAnchors.length, 5, 'all 5 fields unresolved')
  assertEq(
    res4.unresolvedAnchors[0].reason,
    'PDF parse error: boom',
    'extraction error reason propagates',
  )

  console.log()
  console.log('--- Case 5: shared-extract equivalence to legacy findAnchorPosition ---')
  for (const anchor of ANCHORS) {
    const sharedRes = resolveAnchor(positions, anchor)
    const legacyRes = await findAnchorPosition(buffer, anchor)
    assertEq(
      sharedRes,
      legacyRes,
      `${anchor}: shared-extract matches legacy findAnchorPosition`,
    )
  }

  console.log()
  if (exitCode === 0) console.log('ALL TESTS PASSED')
  else console.log('TESTS FAILED')
  process.exit(exitCode)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
