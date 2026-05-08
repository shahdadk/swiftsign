import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { stripe, getOrCreateCustomer } from '@/lib/stripe'
import { PLANS } from '@/lib/plans'
import { env, billingEnabled } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  plan: z.enum(['PRO', 'TEAM']),
})

export async function POST(request: Request) {
  if (!billingEnabled) {
    return NextResponse.json(
      { error: 'Billing is not yet available — every account is unlimited during beta.' },
      { status: 503 }
    )
  }

  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const config = PLANS[parsed.data.plan]
  if (!config.priceIdMonthly) {
    return NextResponse.json({ error: 'Plan not available' }, { status: 400 })
  }

  try {
    const customerId = await getOrCreateCustomer(user)

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: config.priceIdMonthly, quantity: 1 }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=1`,
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id, plan: parsed.data.plan },
      },
      metadata: { userId: user.id, plan: parsed.data.plan },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error(err, { route: 'POST /api/billing/checkout', userId: user.id })
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
