import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { publicApiKeyView } from '@/lib/api-key'
import { ApiKeyCard } from './api-key-card'
import { SessionsCard } from './sessions-card'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSession()
  if (!user) redirect('/dashboard/login')

  const keyRecords = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  const keys = keyRecords.map(publicApiKeyView)

  return (
    <main className="container" style={{ padding: '40px 0 80px' }}>
      <div className="section-head" style={{ textAlign: 'left', marginBottom: 24 }}>
        <div className="eyebrow">Settings</div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '8px 0 4px',
          }}
        >
          Account
        </h1>
        <p className="mono" style={{ color: 'var(--ink-4)', fontSize: 13 }}>
          {user.email}
        </p>
      </div>

      <ApiKeyCard initialKeys={keys} />

      <SessionsCard />

      {/* Advanced — developer-facing surfaces hidden from the primary nav
          but reachable here. Per the design memo: only show concepts to
          users who actively need them. */}
      <section
        style={{
          marginTop: 48,
          paddingTop: 32,
          borderTop: '1px solid var(--line)',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          Advanced · for developers
        </div>
        <div className="env-card">
          <div className="env-card-head">
            <div className="env-card-title">
              <h3>Webhooks</h3>
              <p className="env-card-docs">
                HTTPS callbacks for envelope events (sent / viewed / signed /
                completed / declined / voided). Most users don&apos;t need this — your
                agent already knows the status because it called the API. Useful
                only if you&apos;re building automation that reacts to envelope events
                inside your own service.
              </p>
            </div>
            <Link
              href="/dashboard/webhooks"
              className="btn-link btn-link-primary"
              style={{ flexShrink: 0 }}
            >
              manage →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
