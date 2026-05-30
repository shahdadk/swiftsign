/**
 * Smoke test for the PAdES/CAdES-T signing module.
 *
 * Generates a tiny PDF, runs it through signPdfBuffer against the bundled
 * self-signed cert (certs/swiftsign.p12, via the cert-loader fallback), writes
 * the result to /tmp/signed-smoke.pdf, and asserts:
 *   - the output contains /ByteRange
 *   - the output contains /Contents <...>
 *   - the embedded hex bytes parse as a PKCS#7 SignedData (re-parsed by forge)
 *
 * Prints PASS/FAIL and whether a TSA timestamp token was embedded.
 *
 * Run:  SKIP_ENV_VALIDATION=1 npx tsx scripts/sign-smoke.ts
 *
 * If the TSA network call fails (no outbound), the CAdES-BES fallback keeps the
 * smoke passing — only the "timestamp embedded" line flips to false.
 */
process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? '1'

import { writeFileSync } from 'fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import forge from 'node-forge'
import { signPdfBuffer } from '../src/lib/signing/sign-pdf'

const OUT = '/tmp/signed-smoke.pdf'
const OID_TIMESTAMP_TOKEN = '1.2.840.113549.1.9.16.2.14'

async function makeTinyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 200])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('SwiftSign smoke test', { x: 20, y: 100, size: 14, font })
  return doc.save()
}

/** Extract the hex inside the LAST /Contents <...> of the signed PDF. */
function extractContentsHex(pdf: Buffer): string | null {
  const marker = pdf.lastIndexOf(Buffer.from('/Contents '))
  if (marker === -1) return null
  const open = pdf.indexOf('<', marker)
  const close = pdf.indexOf('>', open)
  if (open === -1 || close === -1) return null
  let hex = pdf.subarray(open + 1, close).toString('latin1')
  // Strip the zero padding @signpdf appends.
  hex = hex.replace(/0+$/g, '')
  if (hex.length % 2 !== 0) hex = hex.slice(0, hex.length - 1)
  return hex
}

/** Returns true if the SignerInfo carries an id-aa-timeStampToken unsigned attr. */
function hasTimestamp(p7Asn1: forge.asn1.Asn1): boolean {
  // Walk the DER text representation for the OID is brittle; instead re-DER it
  // and look for the OID bytes. The timestamp OID DER value bytes:
  // 2a 86 48 86 f7 0d 01 09 10 02 0e
  const der = forge.asn1.toDer(p7Asn1).getBytes()
  const needle = Buffer.from([
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x02, 0x0e,
  ]).toString('binary')
  void OID_TIMESTAMP_TOKEN
  return der.includes(needle)
}

async function main() {
  let pass = true
  const fail = (msg: string) => {
    console.error('  FAIL:', msg)
    pass = false
  }

  const tiny = await makeTinyPdf()

  const { signed, profile, tsaTime } = await signPdfBuffer(tiny, {
    reason: 'Smoke test signature',
    name: 'SwiftSign Smoke',
    location: 'CI',
    contactInfo: 'smoke@swiftsign.test',
    signingTime: new Date(),
  })

  writeFileSync(OUT, signed)
  console.log(`Wrote ${signed.length} bytes to ${OUT}`)
  console.log(`Profile: ${profile}  tsaTime: ${tsaTime?.toISOString() ?? 'null'}`)

  // Assertion 1: /ByteRange present.
  if (!signed.includes(Buffer.from('/ByteRange'))) {
    fail('/ByteRange not found in output')
  } else {
    console.log('  OK: /ByteRange present')
  }

  // Assertion 2: /Contents <...> present.
  const hex = extractContentsHex(signed)
  if (!hex || hex.length === 0) {
    fail('/Contents <...> not found or empty')
  } else {
    console.log(`  OK: /Contents present (${hex.length / 2} bytes)`)
  }

  // Assertion 3: embedded bytes parse as PKCS#7 SignedData.
  let timestamped = false
  if (hex) {
    try {
      const der = Buffer.from(hex, 'hex')
      const asn1 = forge.asn1.fromDer(
        forge.util.createBuffer(der.toString('binary'))
      )
      const msg = forge.pkcs7.messageFromAsn1(asn1)
      // A SignedData has certificates; confirm at least the signer cert.
      const certCount = (msg as { certificates?: unknown[] }).certificates
        ?.length
      if (!certCount || certCount < 1) {
        fail('PKCS#7 parsed but no certificates present')
      } else {
        console.log(`  OK: PKCS#7 SignedData parses (${certCount} cert(s))`)
      }
      timestamped = hasTimestamp(asn1)
    } catch (e) {
      fail(
        'embedded bytes do not parse as PKCS#7: ' +
          (e instanceof Error ? e.message : String(e))
      )
    }
  }

  console.log(
    `  Timestamp token (TSA) embedded: ${timestamped ? 'YES (CAdES-T)' : 'NO (CAdES-BES)'}`
  )

  console.log('')
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error('RESULT: FAIL (threw)')
  console.error(e)
  process.exit(1)
})
