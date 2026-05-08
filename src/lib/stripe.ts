import Stripe from 'stripe'
import { env } from './env'
import { prisma } from './db'
import type { User } from '@/generated/prisma/client'

let cached: Stripe | null = null

export function stripe(): Stripe {
  if (cached) return cached
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Billing is not configured (STRIPE_SECRET_KEY missing)')
  }
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })
  return cached
}

export async function getOrCreateCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId

  const customer = await stripe().customers.create(
    {
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    },
    { idempotencyKey: `user_${user.id}` }
  )

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}
