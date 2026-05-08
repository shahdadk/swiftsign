import { prisma } from './db'
import { downloadPdf, uploadPdf } from './storage'
import { sealDocument } from './seal'
import { renderPdfToImages } from './pdf-renderer'

/**
 * After a signer completes, flatten their field values into the PDF
 * and re-render page images so the next signer sees them baked into the document.
 */
export async function flattenForNextSigner(envelopeId: string): Promise<void> {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      documents: {
        include: {
          fields: {
            where: { value: { not: null } },
            include: { recipient: { select: { status: true } } },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  for (const doc of envelope.documents) {
    // Get all completed fields for this document
    const completedFields = doc.fields
      .filter((f) => f.value && f.recipient.status === 'SIGNED')
      .map((f) => ({
        type: f.type,
        // Convert 1-indexed page to 0-indexed for seal
        page: f.page - 1,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value!,
      }))

    if (completedFields.length === 0) continue

    // Download original PDF
    const originalPdf = await downloadPdf(doc.originalKey)

    // Embed completed fields into the PDF
    const { sealedPdf } = await sealDocument(originalPdf, completedFields)

    // Re-render the updated PDF to page images
    const pageImages = await renderPdfToImages(sealedPdf)

    // Upload new page images, replacing the old ones
    const imageKeys: string[] = []
    for (const img of pageImages) {
      const imgKey = `envelopes/${envelopeId}/pages/${doc.order}-${img.page}.png`
      await uploadPdf(imgKey, img.pngBuffer)
      imageKeys.push(imgKey)
    }

    // Update document record with new image keys and page count
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
        pageCount: pageImages.length || doc.pageCount,
      },
    })
  }
}
