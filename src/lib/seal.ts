import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createHash } from 'crypto'

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

/**
 * Seals a PDF by inserting all field values (signatures, text, dates, etc.)
 * and computing a SHA-256 integrity hash.
 *
 * Field coordinates are percentage-based (0-100) relative to the page.
 * pdf-lib uses bottom-left origin, so Y is flipped.
 */
export async function sealDocument(
  originalPdf: Buffer,
  fields: SealField[]
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
      if (field.value.startsWith('data:image/png')) {
        try {
          const base64Data = field.value.split(',')[1]
          const imageBytes = Buffer.from(base64Data, 'base64')
          const image = await pdfDoc.embedPng(imageBytes)

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
          // is where the underline sits.
          const boxBottomY = pageHeight - absY - absHeight

          page.drawImage(image, {
            x: absX,
            y: boxBottomY,
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
    } else if (['NAME', 'DATE', 'TEXT'].includes(field.type)) {
      // Text fields — baseline anchored at the box bottom (sits on the line).
      const fontSize = Math.min(12, absHeight * 0.7)
      const font = field.type === 'NAME' ? helveticaBold : helvetica
      const baselineY = pageHeight - absY - absHeight + fontSize * 0.2

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
