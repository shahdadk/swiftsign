import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { downloadPdf } from '@/lib/storage'

/**
 * GET /api/envelopes/[id]/download
 *
 * Returns the sealed (signed) PDF for download.
 *
 * Authentication:
 *   - Bearer API key (Authorization header) — for envelope owner
 *   - Signing token (query param ?token=...) — for recipients
 *
 * Query params:
 *   - token: recipient signing token (alternative to API key)
 *   - doc: document index to download (default: 0, first document)
 *   - certificate: if "true", download the Certificate of Completion instead
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const docIndex = parseInt(url.searchParams.get('doc') ?? '0', 10)
    const wantCertificate = url.searchParams.get('certificate') === 'true'

    // ── Authentication ──────────────────────────────────────────
    let authorized = false

    // Option 1: API key — envelope owner
    const user = await authenticateApiKey(request)
    if (user) {
      const envelope = await prisma.envelope.findUnique({
        where: { id: envelopeId, userId: user.id },
        select: { id: true },
      })
      if (envelope) authorized = true
    }

    // Option 2: Signing token — recipient
    if (!authorized && token) {
      const recipient = await prisma.recipient.findUnique({
        where: { signingToken: token },
        select: { envelopeId: true },
      })
      if (recipient && recipient.envelopeId === envelopeId) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid API key or signing token' },
        { status: 401 }
      )
    }

    // ── Load envelope ───────────────────────────────────────────
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        documents: { orderBy: { order: 'asc' } },
      },
    })

    if (!envelope) {
      return NextResponse.json(
        { error: 'Envelope not found' },
        { status: 404 }
      )
    }

    if (envelope.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: `Envelope is not completed yet (status: ${envelope.status}). Sealed documents are only available after all signers have signed.`,
        },
        { status: 409 }
      )
    }

    // ── Download certificate ────────────────────────────────────
    if (wantCertificate) {
      const certKey = `certificates/${envelopeId}/certificate.pdf`
      try {
        const certBuffer = await downloadPdf(certKey)
        return new NextResponse(new Uint8Array(certBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Certificate-of-Completion-${envelopeId}.pdf"`,
            'Content-Length': certBuffer.length.toString(),
          },
        })
      } catch {
        return NextResponse.json(
          { error: 'Certificate not found' },
          { status: 404 }
        )
      }
    }

    // ── Download sealed document ────────────────────────────────
    if (docIndex < 0 || docIndex >= envelope.documents.length) {
      return NextResponse.json(
        {
          error: `Invalid document index. Envelope has ${envelope.documents.length} document(s) (0-indexed).`,
        },
        { status: 400 }
      )
    }

    const doc = envelope.documents[docIndex]

    if (!doc.signedKey) {
      return NextResponse.json(
        { error: 'Sealed document not available' },
        { status: 404 }
      )
    }

    const pdfBuffer = await downloadPdf(doc.signedKey)

    // Sanitize filename
    const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="signed-${safeName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('GET /api/envelopes/[id]/download error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
