import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { verifyChain } from '@/lib/audit-verify'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

// Public document-verification endpoint. Two modes:
//
// 1. multipart/form-data with a `file` field — proof-of-possession. We hash the
//    uploaded bytes and look for a Document with a matching documentHash. Only
//    on a match do we return envelope detail (the hash gates the PII).
// 2. JSON { envelopeId } — integrity-only. Returns just the chain verdict, no
//    envelope detail / PII.
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 })
    }

    const documentHash = crypto.createHash('sha256').update(bytes).digest('hex')

    const document = await prisma.document.findFirst({
      where: { documentHash },
      select: {
        name: true,
        envelopeId: true,
        envelope: {
          select: { subject: true, status: true, completedAt: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ matched: false })
    }

    const chain = await verifyChain(document.envelopeId)

    return NextResponse.json({
      matched: true,
      envelopeId: document.envelopeId,
      subject: document.envelope.subject,
      status: document.envelope.status,
      completedAt: document.envelope.completedAt,
      documentName: document.name,
      chain,
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const envelopeId =
    body && typeof body === 'object' && 'envelopeId' in body
      ? (body as { envelopeId: unknown }).envelopeId
      : undefined

  if (typeof envelopeId !== 'string' || envelopeId.length === 0) {
    return NextResponse.json({ error: 'Missing envelopeId' }, { status: 400 })
  }

  const chain = await verifyChain(envelopeId)
  return NextResponse.json({ envelopeId, chain })
}
