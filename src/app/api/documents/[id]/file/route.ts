import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { downloadPdf } from '@/lib/storage'
import { logger } from '@/lib/logger'
import { isTokenExpired } from '@/lib/signing-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Streams the original (or sealed-between-signers) PDF binary.
// Auth: signing token must belong to a recipient on the same envelope as the document.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing signing token' }, { status: 401 })
  }

  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: token },
    select: { envelopeId: true, tokenExpiresAt: true, consentedAt: true },
  })

  if (!recipient) {
    return NextResponse.json({ error: 'Invalid signing token' }, { status: 401 })
  }

  // Signer-token path: bytes can't be fetched on an expired link or before the
  // ESIGN disclosure is accepted.
  if (isTokenExpired(recipient.tokenExpiresAt)) {
    return NextResponse.json({ error: 'link expired' }, { status: 410 })
  }

  if (recipient.consentedAt === null) {
    return NextResponse.json({ error: 'consent required' }, { status: 403 })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { envelopeId: true, originalKey: true, signedKey: true, name: true },
  })

  if (!document || document.envelopeId !== recipient.envelopeId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Prefer the partially-flattened version (between signers) if available.
  const key = document.signedKey ?? document.originalKey

  try {
    const pdf = await downloadPdf(key)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'private, max-age=0, no-cache',
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.name)}"`,
      },
    })
  } catch (err) {
    logger.error(err, { route: 'GET /api/documents/[id]/file', docId: id })
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
  }
}
