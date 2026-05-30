import type { NextResponse } from 'next/server'
import { uploadPdf } from '@/lib/storage'
import { renderPdfToImages } from '@/lib/pdf-renderer'
import { logger } from '@/lib/logger'
import { problem } from '@/lib/api-errors'

// Shared size guards — must stay in sync with the envelopes POST constants.
export const MAX_DOC_BYTES = 25 * 1024 * 1024
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_PAGES = 100

export interface IngestedDoc {
  name: string
  key: string
  pageCount: number
  imageKeys: string[]
}

export type IngestResult =
  | { ok: true; docData: IngestedDoc[] }
  | { ok: false; problem: NextResponse }

// Upload + render the supplied PDFs once, returning the persisted R2 keys and
// per-document page image keys. `ownerId` is the envelope id OR template id —
// it only shapes the R2 key prefix (`envelopes/${ownerId}/...`); the same shape
// is reused for templates so the signer/page-serving code needs no changes.
//
// Anchor resolution is intentionally NOT done here — it stays in the envelopes
// route, which needs the parsed text positions for its own coordinate logic.
export async function ingestDocuments(
  ownerId: string,
  documents: { name: string; base64: string }[]
): Promise<IngestResult> {
  // --- Size guards before any R2/render work ---
  let totalBytes = 0
  const buffers: Buffer[] = []
  for (const doc of documents) {
    const buffer = Buffer.from(doc.base64, 'base64')
    if (buffer.byteLength > MAX_DOC_BYTES) {
      return {
        ok: false,
        problem: problem('payload_too_large', {
          detail: `Document "${doc.name}" exceeds ${MAX_DOC_BYTES / (1024 * 1024)}MB limit`,
        }),
      }
    }
    totalBytes += buffer.byteLength
    buffers.push(buffer)
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      problem: problem('payload_too_large', {
        detail: `Total payload exceeds ${MAX_TOTAL_BYTES / (1024 * 1024)}MB limit`,
      }),
    }
  }

  // --- Upload originals + render page PNGs ---
  const docData: IngestedDoc[] = []
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    const buffer = buffers[i]
    const key = `envelopes/${ownerId}/documents/${i}-${doc.name}`

    await uploadPdf(key, buffer)

    let pageImages: Awaited<ReturnType<typeof renderPdfToImages>>
    try {
      pageImages = await renderPdfToImages(buffer)
    } catch (renderErr) {
      const reason = renderErr instanceof Error ? renderErr.message : String(renderErr)
      logger.warn('PDF render failed during ingest', {
        err: reason,
        docName: doc.name,
        docIndex: i,
        ownerId,
      })
      return {
        ok: false,
        problem: problem('pdf_render_failed', {
          detail: reason,
          documentIndex: i,
        }),
      }
    }

    if (pageImages.length > MAX_PAGES) {
      return {
        ok: false,
        problem: problem('payload_too_large', {
          detail: `Document "${doc.name}" has ${pageImages.length} pages; max ${MAX_PAGES} per document`,
        }),
      }
    }

    const pageCount = pageImages.length || 1
    const imageKeys: string[] = []
    for (const img of pageImages) {
      const imgKey = `envelopes/${ownerId}/pages/${i}-${img.page}.png`
      await uploadPdf(imgKey, img.pngBuffer)
      imageKeys.push(imgKey)
    }

    docData.push({ name: doc.name, key, pageCount, imageKeys })
  }

  return { ok: true, docData }
}
