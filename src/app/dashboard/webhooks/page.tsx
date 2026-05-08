import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { WebhooksManager } from './manager'

export const dynamic = 'force-dynamic'

export default async function WebhooksPage() {
  const user = await getSession()
  if (!user) redirect('/dashboard/login')

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  })

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Webhooks</h1>
      <p className="text-sm text-gray-500 mb-6">
        Receive HTTPS callbacks for envelope lifecycle events. Verify deliveries
        with the per-endpoint signing secret.
      </p>
      <WebhooksManager
        initial={endpoints.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </main>
  )
}
