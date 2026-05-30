import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createApiKey, publicApiKeyView, DEFAULT_SCOPES } from '@/lib/api-key'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ keys: keys.map(publicApiKeyView) })
  } catch (err) {
    logger.error(err, { route: 'GET /api/account/api-key', userId: user.id })
    return NextResponse.json(
      { error: 'Failed to list keys' },
      { status: 500 }
    )
  }
}

const CreateBody = z.object({
  name: z.string().optional(),
  mode: z.enum(['LIVE', 'TEST']).optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
})

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = CreateBody.safeParse(json ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  try {
    const { secret, record } = await createApiKey(user.id, {
      name: parsed.data.name,
      mode: parsed.data.mode ?? 'LIVE',
      scopes: parsed.data.scopes ?? DEFAULT_SCOPES,
      expiresAt: parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : null,
    })

    logger.info('api_key_created', { userId: user.id, apiKeyId: record.id })

    return NextResponse.json({ secret, key: publicApiKeyView(record) })
  } catch (err) {
    logger.error(err, { route: 'POST /api/account/api-key', userId: user.id })
    return NextResponse.json(
      { error: 'Failed to create key' },
      { status: 500 }
    )
  }
}
