import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { stripe, getOrCreateCustomer } from '@/lib/stripe'
import { env, billingEnabled } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!billingEnabled) {
    return NextResponse.json(
      { error: 'Billing is not yet available' },
      { status: 503 }
    )
  }

  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const customerId = await getOrCreateCustomer(user)
    const portal = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err) {
    logger.error(err, { route: 'POST /api/billing/portal', userId: user.id })
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
