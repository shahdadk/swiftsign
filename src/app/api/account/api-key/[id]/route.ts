import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const found = await prisma.apiKey.findFirst({
      where: { id, userId: user.id },
    })
    if (!found) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
    logger.info('api_key_revoked', { userId: user.id, apiKeyId: id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error(err, {
      route: 'DELETE /api/account/api-key/[id]',
      userId: user.id,
    })
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
  }
}
