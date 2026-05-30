import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { ingestDocuments } from '@/lib/pdf-ingest'
import { logger } from '@/lib/logger'
import { problem, zodProblem } from '@/lib/api-errors'
import {
  parseLimit,
  decodeCursor,
  cursorWhere,
  buildPage,
} from '@/lib/pagination'
import type { Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ---------- Zod schemas ----------

const TemplateDocumentSchema = z.object({
  name: z.string().min(1),
  base64: z.string().min(1),
})

const TemplateRoleSchema = z.object({
  roleName: z.string().min(1),
  routingOrder: z.number().int().min(1).default(1),
  recipientType: z.enum(['SIGNER', 'CC']).default('SIGNER'),
})

const TemplateFieldSchema = z.object({
  role: z.number().int().min(0),
  document: z.number().int().min(0),
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
  page: z.number().int().min(1).default(1),
  anchor: z.string().optional(),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(0).max(100).optional(),
  height: z.number().min(0).max(100).optional(),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
})

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  documents: z.array(TemplateDocumentSchema).min(1),
  roles: z.array(TemplateRoleSchema).min(1),
  fields: z.array(TemplateFieldSchema).default([]),
})

// ---------- POST /api/v1/templates ----------

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', { detail: 'Provide a valid Bearer API key' })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:write')) {
      return problem('forbidden', { detail: 'API key lacks the envelopes:write scope' })
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return zodProblem(parsed.error)
    }
    const { name, description, documents, roles, fields } = parsed.data

    // Validate field references against the inline arrays.
    for (const f of fields) {
      if (f.role >= roles.length) {
        return problem('validation_error', {
          detail: `Field references role ${f.role} but only ${roles.length} roles provided`,
        })
      }
      if (f.document >= documents.length) {
        return problem('validation_error', {
          detail: `Field references document ${f.document} but only ${documents.length} documents provided`,
        })
      }
    }

    // Upload + render docs ONCE, scoped under the new template id.
    const templateId = crypto.randomUUID()
    const ingest = await ingestDocuments(templateId, documents)
    if (!ingest.ok) {
      return ingest.problem
    }
    const docData = ingest.docData

    const created = await prisma.$transaction(async (tx: Tx) => {
      const template = await tx.template.create({
        data: {
          id: templateId,
          userId: user.id,
          name,
          description: description ?? null,
        },
      })

      const docRecords: Array<{ id: string }> = []
      for (let i = 0; i < docData.length; i++) {
        const d = docData[i]
        const record = await tx.templateDocument.create({
          data: {
            templateId: template.id,
            name: d.name,
            originalKey: d.key,
            pageCount: d.pageCount,
            imageKeys: d.imageKeys.length > 0 ? d.imageKeys : undefined,
            order: i,
          },
        })
        docRecords.push(record)
      }

      const roleRecords: Array<{ id: string }> = []
      for (let i = 0; i < roles.length; i++) {
        const r = roles[i]
        const record = await tx.templateRole.create({
          data: {
            templateId: template.id,
            roleName: r.roleName,
            routingOrder: r.routingOrder,
            recipientType: r.recipientType,
            order: i,
          },
        })
        roleRecords.push(record)
      }

      for (const f of fields) {
        await tx.templateField.create({
          data: {
            templateId: template.id,
            templateDocumentId: docRecords[f.document].id,
            templateRoleId: roleRecords[f.role].id,
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width ?? 30,
            height: f.height ?? 5,
            anchor: f.anchor ?? null,
            required: f.required,
            options:
              f.options && f.options.length > 0
                ? (f.options as Prisma.InputJsonValue)
                : undefined,
          },
        })
      }

      return tx.template.findUniqueOrThrow({
        where: { id: template.id },
        include: {
          documents: { orderBy: { order: 'asc' } },
          roles: { orderBy: { order: 'asc' } },
          fields: true,
        },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/templates' })
    return problem('internal_error')
  }
}

// ---------- GET /api/v1/templates ----------

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', { detail: 'Provide a valid Bearer API key' })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:read')) {
      return problem('forbidden', { detail: 'API key lacks the envelopes:read scope' })
    }

    const url = new URL(request.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    const cursor = decodeCursor(url.searchParams.get('cursor'))

    const where: Prisma.TemplateWhereInput = { userId: user.id }
    const cursorFragment = cursorWhere(cursor)
    const finalWhere = cursorFragment ? { AND: [where, cursorFragment] } : where

    const rows = await prisma.template.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        _count: { select: { documents: true, roles: true, fields: true } },
      },
    })

    const page = buildPage(rows, limit)
    return NextResponse.json({
      data: page.data.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        documentCount: t._count.documents,
        roleCount: t._count.roles,
        fieldCount: t._count.fields,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      has_more: page.has_more,
      next_cursor: page.next_cursor,
    })
  } catch (err) {
    logger.error(err, { route: 'GET /api/v1/templates' })
    return problem('internal_error')
  }
}
