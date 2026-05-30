import Link from 'next/link'
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
    <main className="container" style={{ padding: '40px 0 80px' }}>
      <div className="section-head" style={{ textAlign: 'left', marginBottom: 24 }}>
        <div className="eyebrow">Advanced · for developers</div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '8px 0 8px',
          }}
        >
          Webhooks
        </h1>
        <p
          className="mono"
          style={{ color: 'var(--ink-4)', fontSize: 13, maxWidth: 620 }}
        >
          Receive HTTPS callbacks for envelope lifecycle events. Verify each
          delivery with the per-endpoint signing secret SwiftSign generates at
          creation. If you&apos;re not building automation, you don&apos;t need this —{' '}
          <Link href="/dashboard/settings" style={{ color: 'var(--accent)' }}>
            back to Settings
          </Link>
          .
        </p>
      </div>

      <WebhooksManager
        initial={endpoints.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </main>
  )
}
