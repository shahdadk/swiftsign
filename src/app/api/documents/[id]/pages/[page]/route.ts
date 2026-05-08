import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { downloadPdf } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; page: string }> },
) {
  try {
    const { id, page: pageStr } = await params
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing signing token' },
        { status: 401 },
      )
    }

    const pageNum = parseInt(pageStr, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: 'Invalid page number' },
        { status: 400 },
      )
    }

    // Validate token: find recipient by signingToken
    const recipient = await prisma.recipient.findUnique({
      where: { signingToken: token },
      select: { envelopeId: true },
    })

    if (!recipient) {
      return NextResponse.json(
        { error: 'Invalid signing token' },
        { status: 401 },
      )
    }

    // Look up the document and verify it belongs to the same envelope
    const document = await prisma.document.findUnique({
      where: { id },
      select: { envelopeId: true, imageKeys: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    if (document.envelopeId !== recipient.envelopeId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 },
      )
    }

    // imageKeys is a JSON array of R2 keys for page PNGs
    const imageKeys = document.imageKeys as string[] | null
    if (!imageKeys || !Array.isArray(imageKeys)) {
      return NextResponse.json(
        { error: 'Page images not available' },
        { status: 404 },
      )
    }

    const keyIndex = pageNum - 1
    if (keyIndex >= imageKeys.length) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 },
      )
    }

    const r2Key = imageKeys[keyIndex]
    const pngBuffer = await downloadPdf(r2Key)

    return new Response(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('GET /api/documents/[id]/pages/[page] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
