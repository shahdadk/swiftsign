import { prisma } from './db'
import { PLANS } from './plans'
import { billingEnabled } from './env'
import type { Plan, SubscriptionStatus } from '@/generated/prisma/client'

export type QuotaResult = {
  allowed: boolean
  plan: Plan
  used: number
  limit: number | 'unlimited'
  remaining: number | 'unlimited'
  resetAt: Date
}

const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

function utcStartOfMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0))
}

function utcStartOfNextMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

export async function checkQuota(userId: string): Promise<QuotaResult> {
  const reset = utcStartOfNextMonth()

  // Billing not configured yet — everyone gets unlimited during the beta.
  if (!billingEnabled) {
    return {
      allowed: true,
      plan: 'PRO',
      used: 0,
      limit: 'unlimited',
      remaining: 'unlimited',
      resetAt: reset,
    }
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscription: true },
  })

  const hasActiveSub =
    user.subscription && ACTIVE_STATUSES.includes(user.subscription.status)
  const effectivePlan: Plan = hasActiveSub ? user.plan : 'FREE'

  const plan = PLANS[effectivePlan]
  const start = utcStartOfMonth()

  if (plan.monthlyEnvelopeQuota === 'unlimited') {
    return {
      allowed: true,
      plan: effectivePlan,
      used: 0,
      limit: 'unlimited',
      remaining: 'unlimited',
      resetAt: reset,
    }
  }

  const used = await prisma.envelope.count({
    where: { userId, createdAt: { gte: start } },
  })

  const remaining = Math.max(0, plan.monthlyEnvelopeQuota - used)
  return {
    allowed: used < plan.monthlyEnvelopeQuota,
    plan: effectivePlan,
    used,
    limit: plan.monthlyEnvelopeQuota,
    remaining,
    resetAt: reset,
  }
}
