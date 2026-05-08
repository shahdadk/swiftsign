import { env } from './env'
import type { Plan } from '@/generated/prisma/client'

export type PlanConfig = {
  id: Plan
  label: string
  priceMonthlyUsd: number | null
  priceIdMonthly: string | null
  monthlyEnvelopeQuota: number | 'unlimited'
  features: string[]
}

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    id: 'FREE',
    label: 'Free',
    priceMonthlyUsd: 0,
    priceIdMonthly: null,
    monthlyEnvelopeQuota: 5,
    features: [
      '5 envelopes per month',
      'MCP server access',
      'REST API + bearer auth',
      'ESIGN/UETA/PIPEDA compliant sealed PDFs',
    ],
  },
  PRO: {
    id: 'PRO',
    label: 'Pro',
    priceMonthlyUsd: 15,
    priceIdMonthly: env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    monthlyEnvelopeQuota: 'unlimited',
    features: [
      'Unlimited envelopes',
      'Webhook subscriptions',
      'Email + audit log support',
      'Routing-order signing',
      'Priority email support',
    ],
  },
  TEAM: {
    id: 'TEAM',
    label: 'Team',
    priceMonthlyUsd: 79,
    priceIdMonthly: env.STRIPE_PRICE_TEAM_MONTHLY ?? null,
    monthlyEnvelopeQuota: 'unlimited',
    features: [
      'Everything in Pro',
      'Custom branding',
      'Higher rate limits (1000/h)',
      'Slack support channel',
    ],
  },
}

export function planFromPriceId(priceId: string): Plan {
  if (env.STRIPE_PRICE_PRO_MONTHLY && priceId === env.STRIPE_PRICE_PRO_MONTHLY) return 'PRO'
  if (env.STRIPE_PRICE_TEAM_MONTHLY && priceId === env.STRIPE_PRICE_TEAM_MONTHLY) return 'TEAM'
  return 'FREE'
}
