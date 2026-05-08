import { prisma } from './db'
import { downloadPdf, uploadPdf } from './storage'
import { sealDocument } from './seal'

/**
 * After a signer in routing-order envelope completes, bake their field values
 * into the PDF binary so the next signer sees prior signatures inline.
 *
 * Stores the flattened PDF at sealed/{envelopeId}/flattened-{name} and updates
 * Document.signedKey. The signing-flow file route at
 * `/api/documents/[id]/file` prefers signedKey over originalKey, so the next
 * signer's react-pdf viewer automatically loads the flattened version.
 *
 * Throws on any failure — the caller is expected to surface a real error to
 * the signer rather than silently emailing the next signer with an
 * unflattened doc.
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

    // Always start from the ORIGINAL PDF (so this is idempotent across
    // multiple flatten calls — re-baking the same fields produces the same
    // bytes).
    const originalPdf = await downloadPdf(doc.originalKey)
    const { sealedPdf } = await sealDocument(originalPdf, completedFields)

    const flattenedKey = `sealed/${envelopeId}/flattened-${doc.name}`
    await uploadPdf(flattenedKey, sealedPdf)

    await prisma.document.update({
      where: { id: doc.id },
      data: { signedKey: flattenedKey },
    })
  }
}
