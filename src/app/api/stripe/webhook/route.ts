import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { env, billingEnabled } from '@/lib/env'
import { logger } from '@/lib/logger'
import { planFromPriceId } from '@/lib/plans'
import type { SubscriptionStatus } from '@/generated/prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
      return 'ACTIVE'
    case 'trialing':
      return 'TRIALING'
    case 'past_due':
      return 'PAST_DUE'
    case 'canceled':
      return 'CANCELED'
    case 'incomplete':
      return 'INCOMPLETE'
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED'
    case 'unpaid':
      return 'UNPAID'
    default:
      return 'INCOMPLETE'
  }
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId
  if (!userId) {
    logger.warn('Stripe webhook: subscription has no userId metadata', {
      stripeSubId: sub.id,
    })
    return
  }

  const priceId = sub.items.data[0]?.price.id
  if (!priceId) return
  const plan = planFromPriceId(priceId)
  const status = mapStatus(sub.status)
  const subAny = sub as unknown as {
    current_period_start: number
    current_period_end: number
  }

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { stripeSubId: sub.id },
      update: {
        stripePriceId: priceId,
        status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: new Date(subAny.current_period_start * 1000),
        currentPeriodEnd: new Date(subAny.current_period_end * 1000),
      },
      create: {
        userId,
        stripeSubId: sub.id,
        stripePriceId: priceId,
        status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: new Date(subAny.current_period_start * 1000),
        currentPeriodEnd: new Date(subAny.current_period_end * 1000),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan },
    }),
  ])
}

export async function POST(request: Request) {
  if (!billingEnabled || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Billing is not yet available' },
      { status: 503 }
    )
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', {
      err: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription && typeof session.subscription === 'string') {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription
          )
          // Stripe Checkout doesn't always copy metadata to the subscription
          // Make sure userId/plan are present
          if (!sub.metadata?.userId && session.metadata?.userId) {
            await stripe().subscriptions.update(sub.id, {
              metadata: {
                userId: session.metadata.userId,
                plan: session.metadata.plan ?? '',
              },
            })
            sub.metadata = {
              userId: session.metadata.userId,
              plan: session.metadata.plan ?? '',
            }
          }
          await upsertSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscription(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          await prisma.$transaction([
            prisma.subscription.updateMany({
              where: { stripeSubId: sub.id },
              data: { status: 'CANCELED', cancelAtPeriodEnd: false },
            }),
            prisma.user.update({
              where: { id: userId },
              data: { plan: 'FREE' },
            }),
          ])
        }
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const subId =
          (inv as unknown as { subscription?: string }).subscription ??
          undefined
        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripeSubId: subId },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }
      case 'invoice.paid':
        // No-op for now; subscription.updated will fire too
        break
      default:
        // ignore other event types
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error(err, {
      route: 'POST /api/stripe/webhook',
      eventType: event.type,
      eventId: event.id,
    })
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }
}
