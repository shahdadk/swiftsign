/**
 * signPdfBuffer — the orchestration entry the seal pipeline calls.
 *
 * Adds a PAdES signature placeholder (via @signpdf/placeholder-pdf-lib), saves
 * the PDF WITHOUT object streams (so @signpdf can locate the ByteRange), then
 * runs the PadesSigner to embed a detached CAdES-T (or CAdES-BES fallback)
 * signature into /Contents.
 *
 * NODE runtime only (the signing route runs in Node, not Edge).
 */
import { PDFDocument } from 'pdf-lib'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils'
import { SignPdf } from '@signpdf/signpdf'
import { PadesSigner } from './pades-signer'

/**
 * The PKCS#7 with full chain + a TSA token is large; a generous placeholder is
 * mandatory. Undersizing corrupts the file (@signpdf throws "Signature exceeds
 * placeholder length").
 */
const SIGNATURE_LENGTH = 16384

export interface SignPdfOptions {
  reason: string
  name: string
  location?: string
  contactInfo?: string
  signingTime?: Date
}

export interface SignPdfResult {
  signed: Buffer
  profile: string
  tsaTime: Date | null
}

export async function signPdfBuffer(
  pdfBytes: Uint8Array,
  opts: SignPdfOptions
): Promise<SignPdfResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes)

  pdflibAddPlaceholder({
    pdfDoc,
    reason: opts.reason,
    contactInfo: opts.contactInfo ?? '',
    name: opts.name,
    location: opts.location ?? '',
    signatureLength: SIGNATURE_LENGTH,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    signingTime: opts.signingTime,
  })

  // Object streams MUST be disabled or @signpdf can't find the ByteRange.
  const pdfWithPlaceholder = Buffer.from(
    await pdfDoc.save({ useObjectStreams: false })
  )

  const signer = new PadesSigner()
  const signed = await new SignPdf().sign(
    pdfWithPlaceholder,
    signer,
    opts.signingTime
  )

  return {
    signed,
    profile: signer.lastSignatureProfile,
    // We embed the TSA's own token; the trusted time lives inside it. We report
    // the signingTime used as a proxy only when CAdES-T was achieved.
    tsaTime:
      signer.lastSignatureProfile === 'CAdES-T'
        ? (opts.signingTime ?? new Date())
        : null,
  }
}
