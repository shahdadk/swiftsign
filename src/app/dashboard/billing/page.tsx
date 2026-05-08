import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'
import { checkQuota } from '@/lib/quota'
import { billingEnabled } from '@/lib/env'
import { CheckoutButton, PortalButton } from './buttons'

export const dynamic = 'force-dynamic'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/dashboard/login')

  const params = await searchParams

  if (!billingEnabled) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing</h1>
        <p className="text-sm text-gray-500 mb-8">
          Paid plans are coming soon. Every account is unlimited during the beta —
          send as many envelopes as you need, no card required.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">What&apos;s coming</h2>
          <ul className="text-sm text-gray-600 space-y-1.5 mt-3">
            <li>• <b>Free</b> — 5 envelopes / month, MCP + REST API</li>
            <li>• <b>Pro $15/mo</b> — unlimited envelopes, webhooks, priority support</li>
            <li>• <b>Team $79/mo</b> — higher rate limits, custom branding, Slack support</li>
          </ul>
          <p className="text-sm text-gray-500 mt-5">
            We&apos;ll email you before flipping the switch. In the meantime, just keep using
            the API.
          </p>
        </div>
      </main>
    )
  }

  const [subscription, quota] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    checkQuota(user.id),
  ])

  const currentPlanConfig = PLANS[user.plan]

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Billing</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage your plan, payment method, and invoices.
      </p>

      {params.success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          Subscription activated. Your plan is now {currentPlanConfig.label}.
        </div>
      )}
      {params.canceled && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Checkout canceled.
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Current plan: {currentPlanConfig.label}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {quota.limit === 'unlimited'
                ? `${quota.used} envelopes used this month — unlimited`
                : `${quota.used} / ${quota.limit} envelopes used this month`}
            </p>
            {subscription && (
              <p className="text-xs text-gray-400 mt-2">
                {subscription.cancelAtPeriodEnd
                  ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                {' · '}
                Status: {subscription.status}
              </p>
            )}
          </div>
          {subscription && <PortalButton />}
        </div>
      </section>

      {user.plan === 'FREE' && (
        <section className="grid sm:grid-cols-2 gap-4">
          {(['PRO', 'TEAM'] as const).map((p) => {
            const plan = PLANS[p]
            return (
              <div
                key={p}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {plan.label}
                </h3>
                <p className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.priceMonthlyUsd}
                  </span>
                  <span className="text-sm text-gray-500"> / month</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-blue-600">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <CheckoutButton plan={p} label={`Upgrade to ${plan.label}`} />
                </div>
              </div>
            )
          })}
        </section>
      )}

      <p className="text-xs text-gray-400 mt-8">
        Tax (GST/HST/VAT) calculated automatically at checkout based on your
        billing address. Cancel anytime from the Stripe customer portal.
      </p>
    </main>
  )
}
