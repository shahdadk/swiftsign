import { stripe, getOrCreateCustomer } from './stripe'
import { prisma } from './db'
import { PLANS } from './plans'
import { env, teamSelfServeEnabled } from './env'
import type { User } from '@/generated/prisma/client'

export type UpgradeResult =
  | { kind: 'checkout_url'; url: string }
  | { kind: 'updated' }
  | { kind: 'error'; status: number; error: string; contactUrl?: string }

// Shared upgrade path used by the dashboard checkout AND the agent-callable
// /api/v1/billing/upgrade. If the user already has a (non-canceled)
// subscription, switch the price with proration instead of creating a second
// subscription. Otherwise return a hosted Checkout URL the dev opens once to
// enter a card.
export async function startUpgrade(
  user: User,
  plan: 'PRO' | 'TEAM'
): Promise<UpgradeResult> {
  if (plan === 'TEAM' && !teamSelfServeEnabled) {
    return {
      kind: 'error',
      status: 409,
      error: 'The Team plan is not self-serve. Contact sales to upgrade.',
      contactUrl: 'mailto:sales@swiftsign.ca',
    }
  }

  const config = PLANS[plan]
  if (!config.priceIdMonthly) {
    return { kind: 'error', status: 400, error: 'Plan not available' }
  }

  const customerId = await getOrCreateCustomer(user)

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (existing && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existing.status)) {
    const sub = await stripe().subscriptions.retrieve(existing.stripeSubId)
    const itemId = sub.items.data[0]?.id
    if (itemId) {
      await stripe().subscriptions.update(existing.stripeSubId, {
        items: [{ id: itemId, price: config.priceIdMonthly }],
        proration_behavior: 'create_prorations',
        metadata: { userId: user.id, plan },
      })
      return { kind: 'updated' }
    }
  }

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
    subscription_data: { metadata: { userId: user.id, plan } },
    metadata: { userId: user.id, plan },
  })

  if (!session.url) {
    return { kind: 'error', status: 502, error: 'Stripe did not return a checkout URL' }
  }
  return { kind: 'checkout_url', url: session.url }
}
