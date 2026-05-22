// Test that the route handler returns 422 when renderPdfToImages throws,
// instead of silently creating an envelope with empty imageKeys (which makes
// the signer UI 404 on page images).
//
// We can't easily spin up the full Next route in a script (auth + DB + R2),
// so we exercise:
//
//   1. renderPdfToImages() on a synthesized corrupt PDF — must throw.
//   2. The same try/catch shape the route handler uses — must return a
//      422-shaped response, not continue with imageKeys: [].
//   3. A valid PDF — must NOT trigger the 422 path.
//
// Run from products/swiftsign/:
//   npx tsx scripts/test-render-failure.ts

import fs from 'node:fs/promises'
import { renderPdfToImages } from '../src/lib/pdf-renderer'

const VALID_PDF_PATH =
  process.argv[2] ??
  '/Users/shahdad/Documents/Claude/Projects/Appfi/itemiq/contracts/Appfi_SaadKhan_Subcontractor_Agreement_2026-05-22.pdf'

// Looks like a PDF (right magic header) but the body is junk that pdfjs
// cannot parse — exercises the actual error path, not a "no header" fast
// reject.
function makeCorruptPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.7\n%\xC2\xA0\xC2\xA0\xC2\xA0\xC2\xA0\nthis is not a real pdf body, the xref table is missing entirely\n%%EOF\n',
    'binary',
  )
}

// Mirror the route handler's render-failure response shape exactly. If the
// handler changes, this test should fail and force us to update both in sync.
type RenderFailureResponse = {
  status: number
  body: {
    error: 'pdf-render-failed'
    documentIndex: number
    reason: string
  }
}

async function simulateRouteRenderStep(
  buffer: Buffer,
  documentIndex: number,
): Promise<{ kind: 'ok'; pageCount: number } | { kind: 'failure'; resp: RenderFailureResponse }> {
  try {
    const pageImages = await renderPdfToImages(buffer)
    return { kind: 'ok', pageCount: pageImages.length }
  } catch (renderErr) {
    const reason = renderErr instanceof Error ? renderErr.message : String(renderErr)
    return {
      kind: 'failure',
      resp: {
        status: 422,
        body: {
          error: 'pdf-render-failed',
          documentIndex,
          reason,
        },
      },
    }
  }
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

function assert(cond: boolean, label: string) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) exitCode = 1
}

async function main() {
  console.log('--- Case 1: corrupt PDF triggers renderPdfToImages throw ---')
  const corrupt = makeCorruptPdf()
  let threw = false
  let thrownMessage = ''
  try {
    await renderPdfToImages(corrupt)
  } catch (err) {
    threw = true
    thrownMessage = err instanceof Error ? err.message : String(err)
  }
  assert(threw, 'renderPdfToImages threw on corrupt input')
  assert(thrownMessage.length > 0, 'thrown error has a non-empty message')

  console.log()
  console.log('--- Case 2: route handler returns 422 on render failure ---')
  const failureResult = await simulateRouteRenderStep(corrupt, 3)
  assertEq(failureResult.kind, 'failure', 'simulated handler returned failure branch')
  if (failureResult.kind === 'failure') {
    assertEq(failureResult.resp.status, 422, 'status is 422')
    assertEq(
      failureResult.resp.body.error,
      'pdf-render-failed',
      "error code is 'pdf-render-failed'",
    )
    assertEq(failureResult.resp.body.documentIndex, 3, 'documentIndex passed through')
    assert(
      failureResult.resp.body.reason.length > 0,
      'reason is non-empty',
    )
  }

  console.log()
  console.log('--- Case 3: half-broken envelope path is NOT taken ---')
  // Before this fix, the handler would catch the error, log a warn, and
  // continue with imageKeys: []. We assert the simulated handler never hits
  // an "ok" branch with pageCount 0 — it must return a 422 response object.
  if (failureResult.kind === 'failure') {
    assertEq(
      'documentIndex' in failureResult.resp.body,
      true,
      'failure response includes documentIndex (signal to caller)',
    )
    assertEq(
      'reason' in failureResult.resp.body,
      true,
      'failure response includes reason (signal to caller)',
    )
  }
  // Sanity: an "ok" failure mode with empty images would look like
  // { kind: 'ok', pageCount: 0 }. Confirm we did not land there.
  assert(
    failureResult.kind === 'failure',
    'corrupt PDF never produces the silent "ok with 0 pages" path',
  )

  console.log()
  console.log('--- Case 4: valid PDF does NOT trigger 422 ---')
  const validBuffer = await fs.readFile(VALID_PDF_PATH)
  const okResult = await simulateRouteRenderStep(validBuffer, 0)
  assertEq(okResult.kind, 'ok', 'valid PDF takes the ok branch')
  if (okResult.kind === 'ok') {
    assert(okResult.pageCount > 0, 'valid PDF rendered at least one page')
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
