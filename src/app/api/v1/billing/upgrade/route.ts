import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateApiKey } from '@/lib/auth'
import { startUpgrade } from '@/lib/billing'
import { billingEnabled } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  plan: z.enum(['PRO', 'TEAM']).default('PRO'),
})

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!billingEnabled) {
    return NextResponse.json(
      { error: 'Billing is not yet available — every account is unlimited during beta.' },
      { status: 503 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = Body.safeParse(json ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  try {
    const result = await startUpgrade(auth.user, parsed.data.plan)

    if (result.kind === 'checkout_url') {
      return NextResponse.json({ checkout_url: result.url })
    }
    if (result.kind === 'updated') {
      return NextResponse.json({ status: 'updated' })
    }
    return NextResponse.json(
      {
        error: result.error,
        ...(result.contactUrl ? { contactUrl: result.contactUrl } : {}),
      },
      { status: result.status }
    )
  } catch (err) {
    logger.error(err, { route: 'POST /api/v1/billing/upgrade', userId: auth.user.id })
    return NextResponse.json(
      { error: 'Failed to start upgrade' },
      { status: 500 }
    )
  }
}
