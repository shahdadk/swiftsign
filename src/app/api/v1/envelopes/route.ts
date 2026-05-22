import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { uploadPdf } from '@/lib/storage'
import { logAudit } from '@/lib/audit'
import {
  renderPdfToImages,
  extractTextPositions,
  loadPdf,
  type TextPosition,
  type AnchorResult,
} from '@/lib/pdf-renderer'
import { logger } from '@/lib/logger'
import { checkQuota } from '@/lib/quota'
import { envelopeLimiterFor, rateLimitHeaders } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import type { Prisma } from '@/generated/prisma/client'

const MAX_DOC_BYTES = 25 * 1024 * 1024
const MAX_TOTAL_BYTES = 50 * 1024 * 1024
const MAX_PAGES = 100

type Tx = Prisma.TransactionClient

// ---------- Zod schemas ----------

const DocumentSchema = z.object({
  name: z.string().min(1),
  base64: z.string().min(1),
})

const RecipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['SIGNER', 'CC']).default('SIGNER'),
  routingOrder: z.number().int().min(1).default(1),
})

const FieldSchema = z.object({
  recipientIndex: z.number().int().min(0),
  type: z.enum(['SIGNATURE', 'NAME', 'DATE', 'TEXT', 'INITIALS', 'CHECKBOX']),
  document: z.number().int().min(0),
  page: z.number().int().min(-1).default(1), // -1 means use anchor
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().optional(),
  height: z.number().optional(),
  anchor: z.string().optional(),
  yOffset: z.number().optional(),
})

const CreateEnvelopeSchema = z.object({
  subject: z.string().min(1),
  message: z.string().optional(),
  documents: z.array(DocumentSchema).min(1),
  recipients: z.array(RecipientSchema).min(1),
  fields: z.array(FieldSchema).default([]),
})

// Increase body size limit for large PDFs
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

// ---------- POST /api/v1/envelopes ----------

export async function POST(request: Request) {
  try {
    const user = await authenticateApiKey(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid Bearer API key' },
        { status: 401 }
      )
    }

    // Rate-limit by API key, plan-aware
    const limiter = envelopeLimiterFor(user.plan)
    const rl = await limiter.limit(user.apiKey ?? user.id)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // Quota: count of envelopes this calendar month vs plan
    const quota = await checkQuota(user.id)
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: 'Quota exceeded',
          plan: quota.plan,
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt.toISOString(),
          upgradeUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
        },
        { status: 402 }
      )
    }

    const body = await request.json()
    const parsed = CreateEnvelopeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { subject, message, documents, recipients, fields } = parsed.data

    // Validate field references
    for (const field of fields) {
      if (field.recipientIndex >= recipients.length) {
        return NextResponse.json(
          {
            error: `Field references recipientIndex ${field.recipientIndex} but only ${recipients.length} recipients provided`,
          },
          { status: 400 }
        )
      }
      if (field.document >= documents.length) {
        return NextResponse.json(
          {
            error: `Field references document ${field.document} but only ${documents.length} documents provided`,
          },
          { status: 400 }
        )
      }
    }

    // --- Phase 0: Size guards before any R2/render work ---
    let totalBytes = 0
    const docBuffersPre: Buffer[] = []
    for (const doc of documents) {
      const buffer = Buffer.from(doc.base64, 'base64')
      if (buffer.byteLength > MAX_DOC_BYTES) {
        return NextResponse.json(
          {
            error: `Document "${doc.name}" exceeds ${MAX_DOC_BYTES / (1024 * 1024)}MB limit`,
          },
          { status: 413 }
        )
      }
      totalBytes += buffer.byteLength
      docBuffersPre.push(buffer)
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        {
          error: `Total payload exceeds ${MAX_TOTAL_BYTES / (1024 * 1024)}MB limit`,
        },
        { status: 413 }
      )
    }

    // --- Phase 0.5: Load each PDF ONCE and resolve anchor-based fields ---
    //
    // The previous implementation parsed each anchor-using PDF up to twice:
    // once in extractTextPositions() during anchor resolution, and again in
    // renderPdfToImages() during Phase 1. We now call loadPdf() exactly once
    // per document and reuse the parsed doc for both operations.
    //
    // We do anchor resolution BEFORE Phase 1 (R2 upload + page render) so an
    // anchor failure rejects the request without leaving orphaned R2 objects.
    const docsNeedingAnchors = new Set<number>()
    for (const f of fields) {
      if (f.anchor && f.anchor.length > 0) docsNeedingAnchors.add(f.document)
    }

    // Map of docIdx -> loaded pdfjs doc, shared between anchor extraction and
    // page rendering. The finally block at the bottom of the try below
    // destroys every loaded doc, even on error.
    type LoadedDoc = Awaited<ReturnType<typeof loadPdf>>
    const loadedDocs = new Map<number, LoadedDoc>()

    try {
      const docTextPositions = new Map<number, TextPosition[]>()
      const docExtractionErrors = new Map<number, string>()
      for (const docIdx of docsNeedingAnchors) {
        const buffer = docBuffersPre[docIdx]
        if (!buffer) {
          docExtractionErrors.set(docIdx, 'document buffer missing')
          continue
        }
        try {
          const doc = await loadPdf(buffer)
          loadedDocs.set(docIdx, doc)
          const positions = await extractTextPositions(doc)
          docTextPositions.set(docIdx, positions)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          docExtractionErrors.set(docIdx, msg)
          logger.warn('Anchor text extraction failed for document', {
            docIndex: docIdx,
            docName: documents[docIdx]?.name,
            err: msg,
          })
        }
      }

      const resolveAnchor = (
        positions: TextPosition[],
        anchor: string,
      ): AnchorResult | null => {
        const needle = anchor.toLowerCase()
        let lastMatch: AnchorResult | null = null
        for (const pos of positions) {
          if (pos.text.toLowerCase().includes(needle)) {
            lastMatch = {
              page: pos.page,
              x: pos.x,
              y: pos.y,
              xEnd: pos.x + pos.width,
            }
          }
        }
        return lastMatch
      }

      const unresolvedAnchors: Array<{ anchor: string; document: number; reason: string }> = []
      const resolvedFields = fields.map((f) => {
        let page = f.page
        let x = f.x
        let y = f.y

        if (f.anchor && f.anchor.length > 0) {
          const positions = docTextPositions.get(f.document)
          if (!positions) {
            unresolvedAnchors.push({
              anchor: f.anchor,
              document: f.document,
              reason:
                docExtractionErrors.get(f.document) ??
                'no text positions extracted for document',
            })
          } else {
            const pos = resolveAnchor(positions, f.anchor)
            if (pos) {
              page = pos.page
              x = f.x || pos.x + 8
              y = pos.y + (f.yOffset ?? -2)
            } else {
              unresolvedAnchors.push({
                anchor: f.anchor,
                document: f.document,
                reason: 'anchor text not found in document',
              })
            }
          }
        }

        return { ...f, page: page < 1 ? 1 : page, x, y }
      })

      // Surface anchor-resolution failures to the caller. Previously these
      // were swallowed and the field silently landed at (page=1, x=0, y=0),
      // which is invisible until a recipient opens the document.
      if (unresolvedAnchors.length > 0) {
        logger.warn('Refusing envelope create: unresolved anchors', {
          unresolvedAnchors,
        })
        return NextResponse.json(
          {
            error: 'Anchor resolution failed for one or more fields',
            unresolvedAnchors,
          },
          { status: 422 },
        )
      }

      // --- Phase 1: Heavy I/O (upload PDFs, render images) OUTSIDE transaction ---
      const envId = crypto.randomUUID()
      const docData: Array<{ name: string; key: string; pageCount: number; imageKeys: string[] }> = []

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        const buffer = docBuffersPre[i]
        const key = `envelopes/${envId}/documents/${i}-${doc.name}`

        await uploadPdf(key, buffer)

        let pageCount = 1
        const imageKeysList: string[] = []
        try {
          // Reuse the already-loaded doc if anchor extraction loaded one;
          // otherwise load now (and let renderPdfToImages destroy it).
          const cachedDoc = loadedDocs.get(i)
          const pageImages = cachedDoc
            ? await renderPdfToImages(cachedDoc)
            : await renderPdfToImages(buffer)
          if (pageImages.length > MAX_PAGES) {
            return NextResponse.json(
              {
                error: `Document "${doc.name}" has ${pageImages.length} pages; max ${MAX_PAGES} per document`,
              },
              { status: 413 }
            )
          }
          pageCount = pageImages.length || 1
          for (const img of pageImages) {
            const imgKey = `envelopes/${envId}/pages/${i}-${img.page}.png`
            await uploadPdf(imgKey, img.pngBuffer)
            imageKeysList.push(imgKey)
          }
        } catch (renderErr) {
          logger.warn('PDF render skipped, continuing without images', {
            err: renderErr instanceof Error ? renderErr.message : String(renderErr),
            docName: doc.name,
          })
        }

        docData.push({ name: doc.name, key, pageCount, imageKeys: imageKeysList })
      }

      // --- Phase 2: Fast DB writes in transaction ---
      const envelope = await prisma.$transaction(async (tx: Tx) => {
        const env = await tx.envelope.create({
          data: { id: envId, userId: user.id, subject, message: message ?? null },
        })

        const docRecords: Array<{ id: string }> = []
        for (let i = 0; i < docData.length; i++) {
          const d = docData[i]
          const record = await tx.document.create({
            data: {
              envelopeId: env.id,
              name: d.name,
              originalKey: d.key,
              pageCount: d.pageCount,
              imageKeys: d.imageKeys.length > 0 ? d.imageKeys : undefined,
              order: i,
            },
          })
          docRecords.push(record)
        }

        const recipientRecords: Array<{ id: string }> = []
        for (const r of recipients) {
          const record = await tx.recipient.create({
            data: {
              envelopeId: env.id,
              name: r.name,
              email: r.email,
              role: r.role,
              routingOrder: r.routingOrder,
            },
          })
          recipientRecords.push(record)
        }

        for (const f of resolvedFields) {
          await tx.field.create({
            data: {
              documentId: docRecords[f.document].id,
              recipientId: recipientRecords[f.recipientIndex].id,
              type: f.type,
              page: f.page,
              x: f.x,
              y: f.y,
              width: f.width ?? 30,
              height: f.height ?? 5,
            },
          })
        }

        return tx.envelope.findUniqueOrThrow({
          where: { id: env.id },
          include: {
            documents: { orderBy: { order: 'asc' } },
            recipients: { orderBy: { routingOrder: 'asc' } },
          },
        })
      })

      // Audit log (after transaction commits)
      await logAudit(envelope.id, 'ENVELOPE_CREATED', {
        actorName: user.name ?? undefined,
        actorEmail: user.email,
        metadata: {
          documentCount: documents.length,
          recipientCount: recipients.length,
          fieldCount: fields.length,
        },
      })

      return NextResponse.json(envelope, { status: 201 })
    } finally {
      // Destroy every doc we loaded for shared extraction + rendering.
      // Safe to call destroy() multiple times; pdfjs guards against it.
      for (const doc of loadedDocs.values()) {
        try {
          doc.destroy()
        } catch {
          // ignore: best-effort cleanup
        }
      }
    }
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/envelopes' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ---------- GET /api/v1/envelopes ----------

export async function GET(request: Request) {
  try {
    const user = await authenticateApiKey(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — provide a valid Bearer API key' },
        { status: 401 }
      )
    }

    const envelopes = await prisma.envelope.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { recipients: true } },
      },
    })

    const result = envelopes.map((e: typeof envelopes[number]) => ({
      id: e.id,
      subject: e.subject,
      status: e.status,
      createdAt: e.createdAt,
      recipientCount: e._count.recipients,
    }))

    return NextResponse.json(result)
  } catch (err) {
    logger.error(err, { route: 'GET /api/v1/envelopes' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
