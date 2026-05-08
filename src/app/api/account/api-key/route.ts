import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const newKey = `sk_${crypto.randomBytes(16).toString('hex')}`
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: newKey },
    })

    // Note: API key rotation isn't tied to a specific envelope, so we don't
    // write into AuditLog (which requires envelopeId). Sentry/log capture
    // gives us the audit trail.
    logger.info('api_key_rotated', { userId: user.id })

    return NextResponse.json({ apiKey: newKey })
  } catch (err) {
    logger.error(err, { route: 'POST /api/account/api-key', userId: user.id })
    return NextResponse.json(
      { error: 'Failed to rotate key' },
      { status: 500 }
    )
  }
}
