import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { createHash } from 'crypto'

// ── Signature image normalization ──────────────────────────────
//
// Signatures must land on the document as transparent, ink-tight images. An
// opaque background box covers the signature line and any text near it; a
// huge empty margin shrinks the visible ink and floats it off the line.
//
// New clients already adopt clean PNGs (src/lib/signature-image.ts), but
// legacy saved adoptions and API-submitted images can be opaque — so the
// seal runs the same normalization server-side, defensively.

interface NormalizedImage {
  png: Buffer
  width: number
  height: number
}

const ALPHA_INK_THRESHOLD = 24

function sampleBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number } | null {
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4
    if (data[i + 3] < 200) return
    rs.push(data[i])
    gs.push(data[i + 1])
    bs.push(data[i + 2])
  }
  const stepX = Math.max(1, Math.floor(width / 64))
  const stepY = Math.max(1, Math.floor(height / 64))
  for (let x = 0; x < width; x += stepX) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    push(0, y)
    push(width - 1, y)
  }
  if (rs.length < 8) return null
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }
  return { r: median(rs), g: median(gs), b: median(bs) }
}

/**
 * Strip an opaque light background and crop to the ink bounding box.
 * Returns null when the image can't be processed — callers fall back to
 * embedding the original bytes.
 */
async function normalizeSignatureImage(
  imageBytes: Buffer
): Promise<NormalizedImage | null> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(imageBytes)
    const scale = Math.min(1, 1400 / img.width, 700 / img.height)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    // Only strip the background when the image has no real transparency of
    // its own — a clean cutout must not have its anti-aliased edges eaten.
    let transparentish = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) transparentish++
    }
    if (transparentish / (data.length / 4) <= 0.02) {
      const paper = sampleBackgroundColor(data, w, h)
      if (paper) {
        const luminance = 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b
        if (luminance >= 160) {
          const NEAR = 10
          const FAR = 72
          const alphaScale = 255 / (FAR - NEAR)
          for (let i = 0; i < data.length; i += 4) {
            const d = Math.max(
              Math.abs(data[i] - paper.r),
              Math.abs(data[i + 1] - paper.g),
              Math.abs(data[i + 2] - paper.b)
            )
            const a = Math.max(0, Math.min(255, (d - NEAR) * alphaScale))
            if (a < data[i + 3]) data[i + 3] = a
          }
        }
      }
    }

    // Ink bounding box
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_INK_THRESHOLD) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x1 < 0) return null

    ctx.putImageData(imageData, 0, 0)

    const pad = 8
    const cropX = Math.max(0, x0 - pad)
    const cropY = Math.max(0, y0 - pad)
    const cropW = Math.min(w, x1 + pad + 1) - cropX
    const cropH = Math.min(h, y1 + pad + 1) - cropY

    const out = createCanvas(cropW, cropH)
    out
      .getContext('2d')
      .drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    return { png: out.toBuffer('image/png'), width: cropW, height: cropH }
  } catch (err) {
    console.warn('Seal: signature normalization failed, using original image:', err)
    return null
  }
}

export interface SealField {
  type: string
  x: number
  y: number
  page: number
  value: string
  width: number
  height: number
}

export interface SealResult {
  sealedPdf: Buffer
  documentHash: string
}

export interface SealOptions {
  /**
   * When true, draws a diagonal light-gray "TEST — NOT LEGALLY BINDING"
   * watermark across every page. Used for sandbox (test-mode) envelopes so a
   * sealed copy can never be mistaken for a binding document. Default false.
   */
  watermark?: boolean
}

/**
 * Seals a PDF by inserting all field values (signatures, text, dates, etc.)
 * and computing a SHA-256 integrity hash.
 *
 * Field coordinates are percentage-based (0-100) relative to the page.
 * pdf-lib uses bottom-left origin, so Y is flipped.
 *
 * The optional `opts.watermark` flag stamps a "TEST — NOT LEGALLY BINDING"
 * watermark on every page; it defaults to off so existing 2-arg callers are
 * unaffected.
 */
export async function sealDocument(
  originalPdf: Buffer,
  fields: SealField[],
  opts?: SealOptions
): Promise<SealResult> {
  const pdfDoc = await PDFDocument.load(originalPdf)
  const pages = pdfDoc.getPages()

  // Embed fonts once
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  for (const field of fields) {
    // Skip fields with no value
    if (!field.value) continue

    // Pages are 0-indexed in the fields array
    const pageIndex = field.page
    if (pageIndex < 0 || pageIndex >= pages.length) {
      console.warn(
        `Seal: skipping field — page ${pageIndex} out of range (${pages.length} pages)`
      )
      continue
    }

    const page = pages[pageIndex]
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()

    // Convert percentage coordinates to PDF points
    const absX = (field.x / 100) * pageWidth
    const absY = (field.y / 100) * pageHeight
    const absWidth = (field.width / 100) * pageWidth
    const absHeight = (field.height / 100) * pageHeight

    if (field.type === 'SIGNATURE' || field.type === 'INITIALS') {
      // Signature/initials fields — embed image if data URL, else draw text
      if (field.value.startsWith('data:image/')) {
        try {
          const base64Data = field.value.split(',')[1]
          const imageBytes = Buffer.from(base64Data, 'base64')

          // Normalize: transparent background + ink-tight crop. Falls back
          // to the original bytes if processing fails.
          const normalized = await normalizeSignatureImage(imageBytes)
          const image = normalized
            ? await pdfDoc.embedPng(normalized.png)
            : field.value.startsWith('data:image/png')
              ? await pdfDoc.embedPng(imageBytes)
              : await pdfDoc.embedJpg(imageBytes)

          // Scale image to fit within the field box while maintaining aspect ratio
          const imageAspect = image.width / image.height
          const fieldAspect = absWidth / absHeight

          let drawWidth = absWidth
          let drawHeight = absHeight

          if (imageAspect > fieldAspect) {
            // Image is wider relative to box — constrain by width, shrink height
            drawHeight = absWidth / imageAspect
          } else {
            // Image is taller relative to box — constrain by height, shrink width
            drawWidth = absHeight * imageAspect
          }

          // Bottom-align the signature image within the field box so it sits
          // on the underline. pdf-lib's y for drawImage is the BOTTOM of the
          // image. Field y is top-left in our DB, so:
          //   pdf-lib y of box bottom = pageHeight - absY - absHeight
          // Drawing at that y puts the image bottom on the box bottom, which
          // is where the underline sits. Signatures get a small overhang
          // below the line so descenders cross it the way a pen signature
          // does, instead of hovering above.
          const boxBottomY = pageHeight - absY - absHeight
          const overhang =
            field.type === 'SIGNATURE'
              ? Math.min(absHeight * 0.12, drawHeight * 0.18, 3)
              : 0

          page.drawImage(image, {
            x: absX,
            y: Math.max(0, boxBottomY - overhang),
            width: drawWidth,
            height: drawHeight,
          })
        } catch (err) {
          console.error('Seal: failed to embed signature image:', err)
          // Re-throw so the caller can decide what to do — silently drawing
          // "[Signed]" produces a misleading sealed PDF.
          throw new Error(
            `Failed to embed signature image for field at page ${pageIndex + 1}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      } else {
        // Typed signature — draw as styled text, baseline near the box bottom
        const fontSize = Math.min(16, absHeight * 0.7)
        const baselineY = pageHeight - absY - absHeight + fontSize * 0.2
        page.drawText(field.value, {
          x: absX + 4,
          y: baselineY,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        })
      }
    } else if (['NAME', 'DATE', 'TEXT', 'RADIO', 'DROPDOWN'].includes(field.type)) {
      // Text-style fields. RADIO and DROPDOWN bake the SELECTED option string
      // into the box exactly like a TEXT value. First draw a white rect to
      // redact any underlying text
      // (e.g. "[CLIENT LEGAL NAME]" placeholder), then draw the value on top.
      // This means inline placeholders in paragraphs get cleanly replaced
      // instead of having both the original bracket text AND the typed value
      // visible in the sealed PDF.
      const boxBottomY = pageHeight - absY - absHeight
      page.drawRectangle({
        x: absX,
        y: boxBottomY,
        width: absWidth,
        height: absHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      })

      const font = field.type === 'NAME' ? helveticaBold : helvetica
      const innerWidth = absWidth - 4 // 2pt padding each side

      // Start at the natural size for the box, then shrink until the text
      // actually fits within the available width. This stops typed values
      // from overflowing past the field box and bleeding into surrounding
      // paragraph text (e.g. long company addresses on inline placeholders).
      let fontSize = Math.min(12, absHeight * 0.7)
      const minFontSize = 5
      while (
        fontSize > minFontSize &&
        font.widthOfTextAtSize(field.value, fontSize) > innerWidth
      ) {
        fontSize -= 0.5
      }

      const baselineY = boxBottomY + fontSize * 0.2

      page.drawText(field.value, {
        x: absX + 2,
        y: baselineY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    } else if (field.type === 'CHECKBOX') {
      // Checkbox — draw a check mark if truthy
      if (field.value === 'true' || field.value === '1') {
        const checkSize = Math.min(absWidth, absHeight) * 0.7
        const centerX = absX + absWidth / 2
        const centerY = pageHeight - absY - absHeight / 2

        page.drawText('\u2713', {
          x: centerX - checkSize / 3,
          y: centerY - checkSize / 3,
          size: checkSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        })
      }
    } else if (field.type === 'ATTACHMENT') {
      // We don't embed the uploaded file inline \u2014 just annotate the box with a
      // "Attachment: <value>" label (value is a filename or a short note) so
      // the sealed PDF records that something was attached.
      const boxBottomY = pageHeight - absY - absHeight
      const label = `Attachment: ${field.value}`
      const innerWidth = absWidth - 4

      let fontSize = Math.min(10, absHeight * 0.6)
      const minFontSize = 5
      while (
        fontSize > minFontSize &&
        helvetica.widthOfTextAtSize(label, fontSize) > innerWidth
      ) {
        fontSize -= 0.5
      }

      const baselineY = boxBottomY + fontSize * 0.2
      page.drawText(label, {
        x: absX + 2,
        y: baselineY,
        size: fontSize,
        font: helvetica,
        color: rgb(0.25, 0.25, 0.25),
      })
    }
  }

  // Optional sandbox watermark: a large, diagonal, semi-transparent label on
  // every page so a test-mode sealed PDF can't be mistaken for a binding one.
  if (opts?.watermark) {
    const text = 'TEST \u2014 NOT LEGALLY BINDING'
    for (const page of pages) {
      const pageWidth = page.getWidth()
      const pageHeight = page.getHeight()
      // Size the text to span roughly the page diagonal.
      const fontSize = Math.min(pageWidth, pageHeight) * 0.08
      const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize)
      // Center the rotated text: start point is offset so the ~45deg baseline
      // crosses through the page middle.
      const cx = pageWidth / 2
      const cy = pageHeight / 2
      const rad = (45 * Math.PI) / 180
      const x = cx - (textWidth / 2) * Math.cos(rad)
      const y = cy - (textWidth / 2) * Math.sin(rad)
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0.6, 0.6, 0.6),
        rotate: degrees(45),
        opacity: 0.3,
      })
    }
  }

  // Serialize the modified PDF
  const sealedBytes = await pdfDoc.save()
  const sealedBuffer = Buffer.from(sealedBytes)

  // Compute SHA-256 hash
  const documentHash = createHash('sha256').update(sealedBuffer).digest('hex')

  return {
    sealedPdf: sealedBuffer,
    documentHash,
  }
}
