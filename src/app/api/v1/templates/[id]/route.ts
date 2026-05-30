import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateApiKey } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { problem, zodProblem } from '@/lib/api-errors'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// ---------- GET /api/v1/templates/[id] ----------

export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', { detail: 'Provide a valid Bearer API key' })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:read')) {
      return problem('forbidden', { detail: 'API key lacks the envelopes:read scope' })
    }

    const { id } = await params
    const template = await prisma.template.findFirst({
      where: { id, userId: user.id },
      include: {
        documents: { orderBy: { order: 'asc' } },
        roles: { orderBy: { order: 'asc' } },
        fields: true,
      },
    })
    if (!template) {
      return problem('template_not_found')
    }

    return NextResponse.json(template)
  } catch (err) {
    logger.error(err, { route: 'GET /api/v1/templates/[id]' })
    return problem('internal_error')
  }
}

// ---------- PATCH /api/v1/templates/[id] ----------

const UpdateTemplateSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: 'Provide at least one of name or description',
  })

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', { detail: 'Provide a valid Bearer API key' })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:write')) {
      return problem('forbidden', { detail: 'API key lacks the envelopes:write scope' })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = UpdateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return zodProblem(parsed.error)
    }

    const existing = await prisma.template.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!existing) {
      return problem('template_not_found')
    }

    const data: { name?: string; description?: string | null } = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.description !== undefined) data.description = parsed.data.description

    const updated = await prisma.template.update({
      where: { id },
      data,
      include: {
        documents: { orderBy: { order: 'asc' } },
        roles: { orderBy: { order: 'asc' } },
        fields: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    logger.error(err, { route: 'PATCH /api/v1/templates/[id]' })
    return problem('internal_error')
  }
}

// ---------- DELETE /api/v1/templates/[id] ----------

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const auth = await authenticateApiKey(request)
    if (!auth) {
      return problem('unauthorized', { detail: 'Provide a valid Bearer API key' })
    }
    const { user, apiKey } = auth
    if (!apiKey.scopes.includes('envelopes:write')) {
      return problem('forbidden', { detail: 'API key lacks the envelopes:write scope' })
    }

    const { id } = await params
    const existing = await prisma.template.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!existing) {
      return problem('template_not_found')
    }

    // Cascade deletes documents/roles/fields (onDelete: Cascade in schema).
    await prisma.template.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    logger.error(err, { route: 'DELETE /api/v1/templates/[id]' })
    return problem('internal_error')
  }
}
