import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  extractTextPositions,
  loadPdf,
  type TextPosition,
  type AnchorResult,
} from '@/lib/pdf-renderer'
import { ingestDocuments } from '@/lib/pdf-ingest'
import {
  resolveTemplateToEnvelopeInput,
  type ResolvedEnvelopeInput,
} from '@/lib/templates'
import { logger } from '@/lib/logger'
import { checkQuota } from '@/lib/quota'
import { envelopeLimiterFor, rateLimitHeaders } from '@/lib/rate-limit'
import { withIdempotency } from '@/lib/idempotency'
import { newSigningToken, tokenExpiry } from '@/lib/signing-token'
import {
  problem,
  zodProblem,
} from '@/lib/api-errors'
import {
  parseLimit,
  decodeCursor,
  cursorWhere,
  buildPage,
} from '@/lib/pagination'
import type { Prisma, EnvelopeStatus } from '@/generated/prisma/client'

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

// Field coordinates are percentages (0-100) of page width/height with a
// top-left origin (see CLAUDE.md "Coordinate + indexing conventions").
// Width/height are also percentages and default to 30 / 5 at insert time.
// page: integer >= 1 OR -1 (anchor sentinel). Final page is also bounded
// by document.pageCount at runtime (validated after render in Phase 1.5).
const FieldSchema = z.object({
  recipientIndex: z.number().int().min(0),
  type: z.enum([
    'SIGNATURE',
    'NAME',
    'DATE',
    'TEXT',
    'INITIALS',
    'CHECKBOX',
    'RADIO',
    'DROPDOWN',
    'ATTACHMENT',
  ]),
  document: z.number().int().min(0),
  page: z.number().int().min(-1).default(1), // -1 means use anchor
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(0).max(100).optional(),
  height: z.number().min(0).max(100).optional(),
  anchor: z.string().optional(),
  yOffset: z.number().optional(),
  options: z.array(z.string()).optional(),
})

const InlineEnvelopeSchema = z.object({
  subject: z.string().min(1),
  message: z.string().optional(),
  documents: z.array(DocumentSchema).min(1),
  recipients: z.array(RecipientSchema).min(1),
  fields: z.array(FieldSchema).default([]),
})

const RoleAssignmentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

const TemplateEnvelopeSchema = z.object({
  templateId: z.string().min(1),
  roleAssignments: z.record(z.string(), RoleAssignmentSchema),
  subject: z.string().min(1).optional(),
  message: z.string().optional(),
})

// Increase body size limit for large PDFs
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

// ---------- POST /api/v1/envelopes ----------

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', {
        detail: 'Provide a valid Bearer API key',
      })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:write')) {
      return problem('forbidden', {
        detail: 'API key lacks the envelopes:write scope',
      })
    }

    // Rate-limit by API key, plan-aware
    const limiter = envelopeLimiterFor(user.plan)
    const rl = await limiter.limit(apiKey.id)
    if (!rl.success) {
      return problem('rate_limited', { headers: rateLimitHeaders(rl) })
    }

    // Quota applies to LIVE envelopes only; sandbox (test-mode) sends are free.
    if (auth.livemode) {
      const quota = await checkQuota(user.id)
      if (!quota.allowed) {
        return problem('envelope_quota_exceeded', {
          plan: quota.plan,
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt.toISOString(),
        })
      }
    }

    const rawBody = await request.text()
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return problem('validation_error', { detail: 'Request body is not valid JSON' })
    }

    return withIdempotency(request, user.id, rawBody, async () => {
      // Template path: { templateId, roleAssignments, subject?, message? }
      if (body && typeof body === 'object' && 'templateId' in (body as Record<string, unknown>)) {
        return handleTemplateCreate(body, auth.user, auth.livemode)
      }
      return handleInlineCreate(body, auth.user, auth.livemode)
    })
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/envelopes' })
    return problem('internal_error')
  }
}

// ---------- Inline create (documents + recipients + fields) ----------

async function handleInlineCreate(
  body: unknown,
  user: { id: string; name: string | null; email: string },
  livemode: boolean
): Promise<NextResponse> {
  const parsed = InlineEnvelopeSchema.safeParse(body)
  if (!parsed.success) {
    return zodProblem(parsed.error)
  }

  const { subject, message, documents, recipients, fields } = parsed.data

  // Validate field references
  for (const field of fields) {
    if (field.recipientIndex >= recipients.length) {
      return problem('validation_error', {
        detail: `Field references recipientIndex ${field.recipientIndex} but only ${recipients.length} recipients provided`,
      })
    }
    if (field.document >= documents.length) {
      return problem('validation_error', {
        detail: `Field references document ${field.document} but only ${documents.length} documents provided`,
      })
    }
  }

  // --- Resolve anchor-based fields (load each anchor PDF once) ---
  const docBuffers = documents.map((d) => Buffer.from(d.base64, 'base64'))
  const docsNeedingAnchors = new Set<number>()
  for (const f of fields) {
    if (f.anchor && f.anchor.length > 0) docsNeedingAnchors.add(f.document)
  }

  type LoadedDoc = Awaited<ReturnType<typeof loadPdf>>
  const loadedDocs = new Map<number, LoadedDoc>()

  try {
    const docTextPositions = new Map<number, TextPosition[]>()
    const docExtractionErrors = new Map<number, string>()
    for (const docIdx of docsNeedingAnchors) {
      const buffer = docBuffers[docIdx]
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
      anchor: string
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
      return problem('anchor_unresolved', { unresolvedAnchors })
    }

    // --- Heavy I/O (upload PDFs, render images) OUTSIDE transaction ---
    const envId = crypto.randomUUID()
    const ingest = await ingestDocuments(envId, documents)
    if (!ingest.ok) {
      return ingest.problem
    }
    const docData = ingest.docData

    // --- Validate resolved field coords against per-document pageCount ---
    const fieldErrors: Array<{ fieldIndex: number; reason: string }> = []
    for (let fi = 0; fi < resolvedFields.length; fi++) {
      const rf = resolvedFields[fi]
      const docPageCount = docData[rf.document]?.pageCount ?? 0
      if (!Number.isInteger(rf.page) || rf.page < 1 || rf.page > docPageCount) {
        fieldErrors.push({
          fieldIndex: fi,
          reason: `page ${rf.page} out of range [1, ${docPageCount}] for document ${rf.document}`,
        })
      }
      if (!(rf.x >= 0 && rf.x <= 100)) {
        fieldErrors.push({
          fieldIndex: fi,
          reason: `x ${rf.x} out of range [0, 100] for document ${rf.document}`,
        })
      }
      if (!(rf.y >= 0 && rf.y <= 100)) {
        fieldErrors.push({
          fieldIndex: fi,
          reason: `y ${rf.y} out of range [0, 100] for document ${rf.document}`,
        })
      }
    }
    if (fieldErrors.length > 0) {
      logger.warn('Refusing envelope create: invalid field coords', {
        fieldErrors,
      })
      return problem('validation_error', {
        detail: 'Invalid field coordinates',
        fieldErrors,
      })
    }

    // --- Fast DB writes in transaction ---
    const envelope = await prisma.$transaction(async (tx: Tx) => {
      const env = await tx.envelope.create({
        data: {
          id: envId,
          userId: user.id,
          subject,
          message: message ?? null,
          livemode,
        },
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
            signingToken: newSigningToken(),
            tokenExpiresAt: tokenExpiry(),
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
            options:
              f.options && f.options.length > 0
                ? (f.options as Prisma.InputJsonValue)
                : undefined,
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
    // Destroy every doc we loaded for shared anchor extraction.
    for (const doc of loadedDocs.values()) {
      try {
        doc.destroy()
      } catch {
        // ignore: best-effort cleanup
      }
    }
  }
}

// ---------- Template create (send-by-template) ----------

async function handleTemplateCreate(
  body: unknown,
  user: { id: string; name: string | null; email: string },
  livemode: boolean
): Promise<NextResponse> {
  const parsed = TemplateEnvelopeSchema.safeParse(body)
  if (!parsed.success) {
    return zodProblem(parsed.error)
  }

  const { templateId, roleAssignments, subject, message } = parsed.data

  const template = await prisma.template.findFirst({
    where: { id: templateId, userId: user.id },
    include: { documents: true, roles: true, fields: true },
  })
  if (!template) {
    return problem('template_not_found')
  }

  // Every role must have an assignment.
  const missingRoles = template.roles
    .filter((r) => !roleAssignments[r.roleName])
    .map((r) => r.roleName)
  if (missingRoles.length > 0) {
    return problem('validation_error', {
      detail: 'Missing role assignments',
      missingRoles,
    })
  }

  let resolved: ResolvedEnvelopeInput
  try {
    resolved = resolveTemplateToEnvelopeInput(template, roleAssignments)
  } catch (err) {
    logger.warn('Template resolution failed', {
      templateId,
      err: err instanceof Error ? err.message : String(err),
    })
    return problem('validation_error', {
      detail: err instanceof Error ? err.message : 'Template could not be resolved',
    })
  }

  const envId = crypto.randomUUID()
  const finalSubject = subject ?? template.name

  // No re-upload / re-render — reuse the template's R2 keys.
  const envelope = await prisma.$transaction(async (tx: Tx) => {
    const env = await tx.envelope.create({
      data: {
        id: envId,
        userId: user.id,
        subject: finalSubject,
        message: message ?? null,
        livemode,
      },
    })

    const docRecords: Array<{ id: string }> = []
    for (let i = 0; i < resolved.documents.length; i++) {
      const d = resolved.documents[i]
      const record = await tx.document.create({
        data: {
          envelopeId: env.id,
          name: d.name,
          originalKey: d.originalKey,
          pageCount: d.pageCount,
          imageKeys: d.imageKeys.length > 0 ? d.imageKeys : undefined,
          order: i,
        },
      })
      docRecords.push(record)
    }

    const recipientRecords: Array<{ id: string }> = []
    for (const r of resolved.recipients) {
      const record = await tx.recipient.create({
        data: {
          envelopeId: env.id,
          name: r.name,
          email: r.email,
          role: r.role,
          routingOrder: r.routingOrder,
          signingToken: newSigningToken(),
          tokenExpiresAt: tokenExpiry(),
        },
      })
      recipientRecords.push(record)
    }

    for (const f of resolved.fields) {
      await tx.field.create({
        data: {
          documentId: docRecords[f.documentIndex].id,
          recipientId: recipientRecords[f.recipientIndex].id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          required: f.required,
          options:
            f.options != null
              ? (f.options as Prisma.InputJsonValue)
              : undefined,
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

  await logAudit(envelope.id, 'ENVELOPE_CREATED', {
    actorName: user.name ?? undefined,
    actorEmail: user.email,
    metadata: {
      templateId,
      documentCount: resolved.documents.length,
      recipientCount: resolved.recipients.length,
      fieldCount: resolved.fields.length,
    },
  })

  return NextResponse.json(envelope, { status: 201 })
}

// ---------- GET /api/v1/envelopes ----------

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', {
        detail: 'Provide a valid Bearer API key',
      })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:read')) {
      return problem('forbidden', {
        detail: 'API key lacks the envelopes:read scope',
      })
    }

    const url = new URL(request.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    const cursor = decodeCursor(url.searchParams.get('cursor'))

    // Default to the caller's key mode; ?mode=live|test overrides.
    let livemode = auth.livemode
    const modeParam = url.searchParams.get('mode')
    if (modeParam === 'live') livemode = true
    else if (modeParam === 'test') livemode = false

    const where: Prisma.EnvelopeWhereInput = {
      userId: user.id,
      livemode,
    }

    const status = url.searchParams.get('status')
    if (status) {
      const valid: EnvelopeStatus[] = ['DRAFT', 'SENT', 'COMPLETED', 'DECLINED', 'VOIDED']
      if (!valid.includes(status as EnvelopeStatus)) {
        return problem('validation_error', {
          detail: `Invalid status "${status}"; expected one of ${valid.join(', ')}`,
        })
      }
      where.status = status as EnvelopeStatus
    }

    const createdAfter = url.searchParams.get('created_after')
    const createdBefore = url.searchParams.get('created_before')
    const createdAt: Prisma.DateTimeFilter = {}
    if (createdAfter) {
      const d = new Date(createdAfter)
      if (Number.isNaN(d.getTime())) {
        return problem('validation_error', { detail: 'created_after is not a valid ISO date' })
      }
      createdAt.gte = d
    }
    if (createdBefore) {
      const d = new Date(createdBefore)
      if (Number.isNaN(d.getTime())) {
        return problem('validation_error', { detail: 'created_before is not a valid ISO date' })
      }
      createdAt.lte = d
    }
    if (createdAfter || createdBefore) {
      where.createdAt = createdAt
    }

    const recipientEmail = url.searchParams.get('recipient_email')
    if (recipientEmail) {
      where.recipients = { some: { email: recipientEmail } }
    }

    const cursorFragment = cursorWhere(cursor)
    const finalWhere = cursorFragment ? { AND: [where, cursorFragment] } : where

    const rows = await prisma.envelope.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        _count: { select: { recipients: true } },
      },
    })

    const page = buildPage(rows, limit)
    return NextResponse.json({
      data: page.data.map((e) => ({
        id: e.id,
        subject: e.subject,
        status: e.status,
        livemode: e.livemode,
        createdAt: e.createdAt,
        recipientCount: e._count.recipients,
      })),
      has_more: page.has_more,
      next_cursor: page.next_cursor,
    })
  } catch (err) {
    logger.error(err, { route: 'GET /api/v1/envelopes' })
    return problem('internal_error')
  }
}
