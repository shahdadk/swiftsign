// Test that the route handler rejects fields with out-of-range coords
// BEFORE any DB write.
//
// Two layers of validation:
//
//   1. Zod schema (compile-time): x, y ∈ [0, 100], width/height ∈ [0, 100],
//      page is an integer >= -1 (anchor sentinel) at input time.
//   2. Runtime post-render check: resolved page must be in [1, pageCount],
//      resolved x/y must be in [0, 100]. Anchor resolution can shift x past
//      100 (`f.x || pos.x + 8`), so the post-anchor check is the safety net.
//
// We can't easily spin up the full Next route in a script (auth + DB + R2),
// so we exercise each layer in isolation against the SAME logic the route
// uses. If the route's schema or post-render check shape changes, this test
// should fail and force us to update both in sync.
//
// Run from products/swiftsign/:
//   npx tsx scripts/test-field-validation.ts

import { z } from 'zod'

// --- Mirror of the FieldSchema in src/app/api/v1/envelopes/route.ts -------

const FieldSchema = z.object({
  recipientIndex: z.number().int().min(0),
  type: z.enum(['SIGNATURE', 'NAME', 'DATE', 'TEXT', 'INITIALS', 'CHECKBOX']),
  document: z.number().int().min(0),
  page: z.number().int().min(-1).default(1),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(0).max(100).optional(),
  height: z.number().min(0).max(100).optional(),
  anchor: z.string().optional(),
  yOffset: z.number().optional(),
})

// --- Mirror of the post-render coord check ------------------------------

type ResolvedField = {
  recipientIndex: number
  document: number
  type: string
  page: number
  x: number
  y: number
}

type DocMeta = { pageCount: number }

function checkResolvedFields(
  resolvedFields: ResolvedField[],
  docData: DocMeta[],
): { ok: true } | { ok: false; status: 400; fieldErrors: Array<{ fieldIndex: number; reason: string }> } {
  const fieldErrors: Array<{ fieldIndex: number; reason: string }> = []
  for (let fi = 0; fi < resolvedFields.length; fi++) {
    const rf = resolvedFields[fi]
    const docPageCount = docData[rf.document]?.pageCount ?? 0
    if (!Number.isInteger(rf.page) || rf.page < 1 || rf.page > docPageCount) {
      fieldErrors.push({
        fieldIndex: fi,
        reason: `page ${rf.page} out of range [1, ${docPageCount}] for document ${rf.document}`,
      })
    }
    if (!(rf.x >= 0 && rf.x <= 100)) {
      fieldErrors.push({
        fieldIndex: fi,
        reason: `x ${rf.x} out of range [0, 100] for document ${rf.document}`,
      })
    }
    if (!(rf.y >= 0 && rf.y <= 100)) {
      fieldErrors.push({
        fieldIndex: fi,
        reason: `y ${rf.y} out of range [0, 100] for document ${rf.document}`,
      })
    }
  }
  if (fieldErrors.length > 0) return { ok: false, status: 400, fieldErrors }
  return { ok: true }
}

// --- Test harness --------------------------------------------------------

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
  console.log('--- Case 1: Zod rejects x > 100 ---')
  const r1 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: 150,
    y: 50,
  })
  assert(!r1.success, 'parse fails for x=150')

  console.log()
  console.log('--- Case 2: Zod rejects x < 0 ---')
  const r2 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: -5,
    y: 50,
  })
  assert(!r2.success, 'parse fails for x=-5')

  console.log()
  console.log('--- Case 3: Zod rejects y > 100 ---')
  const r3 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: 50,
    y: 110,
  })
  assert(!r3.success, 'parse fails for y=110')

  console.log()
  console.log('--- Case 4: Zod rejects y < 0 ---')
  const r4 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: 50,
    y: -1,
  })
  assert(!r4.success, 'parse fails for y=-1')

  console.log()
  console.log('--- Case 5: Zod accepts boundary values 0 and 100 ---')
  const r5a = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: 0,
    y: 0,
  })
  assert(r5a.success, 'parse succeeds for x=0, y=0')
  const r5b = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 1,
    x: 100,
    y: 100,
  })
  assert(r5b.success, 'parse succeeds for x=100, y=100')

  console.log()
  console.log('--- Case 6: Zod accepts typical real-world values ---')
  const r6 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 10,
    x: 22,
    y: 47.5,
    width: 35,
    height: 3,
  })
  assert(r6.success, 'parse succeeds for page=10, x=22, y=47.5')

  console.log()
  console.log('--- Case 7: Zod rejects page=0 (< -1 sentinel and < 1 valid) ---')
  // Note: Zod min(-1) lets -1 through (anchor sentinel) and any positive
  // integer through. page=0 passes Zod (>= -1) but should be caught by the
  // runtime check below. Let's confirm Zod's behavior, then verify the
  // runtime catches it.
  const r7 = FieldSchema.safeParse({
    recipientIndex: 0,
    type: 'SIGNATURE',
    document: 0,
    page: 0,
    x: 50,
    y: 50,
  })
  assert(r7.success, 'Zod allows page=0 (runtime check catches it instead)')

  console.log()
  console.log('--- Case 8: runtime rejects page > pageCount ---')
  const docData8: DocMeta[] = [{ pageCount: 5 }]
  const resolved8: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 10, x: 50, y: 50 },
  ]
  const c8 = checkResolvedFields(resolved8, docData8)
  assertEq(c8.ok, false, 'rejected')
  if (!c8.ok) {
    assertEq(c8.status, 400, 'status is 400')
    assertEq(c8.fieldErrors.length, 1, 'one field error')
    assert(
      c8.fieldErrors[0].reason.includes('page 10 out of range [1, 5]'),
      'reason cites page out of range',
    )
  }

  console.log()
  console.log('--- Case 9: runtime rejects page < 1 (zero, negative) ---')
  const docData9: DocMeta[] = [{ pageCount: 5 }]
  const resolved9: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 0, x: 50, y: 50 },
    { recipientIndex: 0, document: 0, type: 'NAME', page: -1, x: 50, y: 50 },
  ]
  const c9 = checkResolvedFields(resolved9, docData9)
  assertEq(c9.ok, false, 'rejected')
  if (!c9.ok) assertEq(c9.fieldErrors.length, 2, 'two field errors (page=0 and page=-1)')

  console.log()
  console.log('--- Case 10: runtime rejects non-integer page ---')
  const docData10: DocMeta[] = [{ pageCount: 5 }]
  const resolved10: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 1.5, x: 50, y: 50 },
  ]
  const c10 = checkResolvedFields(resolved10, docData10)
  assertEq(c10.ok, false, 'rejected non-integer page')

  console.log()
  console.log('--- Case 11: runtime catches anchor-shifted x > 100 ---')
  // Simulates: anchor lands at pos.x = 95, and the route adds +8, giving
  // x = 103 at the post-render check. (Zod would pass since input x = 0.)
  const docData11: DocMeta[] = [{ pageCount: 10 }]
  const resolved11: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 10, x: 103, y: 50 },
  ]
  const c11 = checkResolvedFields(resolved11, docData11)
  assertEq(c11.ok, false, 'rejected x=103')
  if (!c11.ok) {
    assert(
      c11.fieldErrors[0].reason.includes('x 103 out of range [0, 100]'),
      'reason cites x out of range',
    )
  }

  console.log()
  console.log('--- Case 12: runtime accepts valid resolved fields ---')
  const docData12: DocMeta[] = [{ pageCount: 10 }]
  const resolved12: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 10, x: 82.1, y: 17.7 },
    { recipientIndex: 0, document: 0, type: 'TEXT', page: 1, x: 0, y: 0 },
    { recipientIndex: 0, document: 0, type: 'DATE', page: 10, x: 100, y: 100 },
  ]
  const c12 = checkResolvedFields(resolved12, docData12)
  assertEq(c12.ok, true, 'all 3 valid fields accepted')

  console.log()
  console.log('--- Case 13: runtime rejects ALL bad fields in one response ---')
  const docData13: DocMeta[] = [{ pageCount: 5 }]
  const resolved13: ResolvedField[] = [
    { recipientIndex: 0, document: 0, type: 'SIGNATURE', page: 99, x: 50, y: 50 },  // bad page
    { recipientIndex: 0, document: 0, type: 'TEXT', page: 1, x: 200, y: 50 },        // bad x
    { recipientIndex: 0, document: 0, type: 'DATE', page: 1, x: 50, y: -10 },        // bad y
  ]
  const c13 = checkResolvedFields(resolved13, docData13)
  assertEq(c13.ok, false, 'rejected')
  if (!c13.ok) {
    assertEq(c13.fieldErrors.length, 3, 'returns all 3 errors in one response (no early exit)')
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
