import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OAUTH_SCOPES } from '@/lib/oauth'

export const metadata: Metadata = {
  title: 'Authorize · SwiftSign',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// OAuth 2.1 consent screen. An MCP client (Claude, Cursor, ...) lands here via
// the authorization_endpoint; the user signs in with the existing magic-link
// flow and approves scoped API access. Approval mints an auth code via
// POST /api/oauth/authorize.

const SCOPE_LABELS: Record<string, string> = {
  'envelopes:read': 'Read your envelopes, templates, and signed documents',
  'envelopes:write': 'Create, send, and void envelopes on your behalf',
}

function Invalid({ reason }: { reason: string }) {
  return (
    <main className="container" style={{ maxWidth: 480, padding: '80px 24px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Can&apos;t authorize this request</h1>
      <p style={{ color: 'var(--ink-4)', fontSize: 14 }}>{reason}</p>
    </main>
  )
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const get = (k: string) => {
    const v = params[k]
    return typeof v === 'string' ? v : ''
  }

  const clientId = get('client_id')
  const redirectUri = get('redirect_uri')
  const responseType = get('response_type')
  const scope = get('scope')
  const state = get('state')
  const codeChallenge = get('code_challenge')
  const codeChallengeMethod = get('code_challenge_method')
  const resource = get('resource')

  if (!clientId || !redirectUri) return <Invalid reason="Missing client_id or redirect_uri." />
  if (responseType !== 'code') return <Invalid reason="Only response_type=code is supported." />
  if (!codeChallenge || codeChallengeMethod !== 'S256')
    return <Invalid reason="PKCE with S256 is required." />

  const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } })
  if (!client) return <Invalid reason="Unknown client. Re-register and try again." />
  if (!client.redirectUris.includes(redirectUri))
    return <Invalid reason="redirect_uri is not registered for this client." />

  const requestedScopes = scope ? scope.split(' ').filter(Boolean) : OAUTH_SCOPES
  if (requestedScopes.some((s) => !OAUTH_SCOPES.includes(s)))
    return <Invalid reason="Unknown scope requested." />

  const user = await getSession()
  if (!user) {
    const here = `/oauth/authorize?${new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))
    ).toString()}`
    redirect(`/dashboard/login?next=${encodeURIComponent(here)}`)
  }

  const clientLabel = client.name ?? `Unnamed client (${client.id.slice(0, 8)})`

  return (
    <main className="container" style={{ maxWidth: 480, padding: '80px 24px' }}>
      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 16 }}>
        swiftsign · authorize
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>
        <strong>{clientLabel}</strong> wants to connect
      </h1>
      <p style={{ color: 'var(--ink-4)', fontSize: 14, marginBottom: 20 }}>
        Signed in as <strong>{user.email}</strong>. This grants a revocable API key
        (manage it under Dashboard → Settings).
      </p>
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28 }}>
        {requestedScopes.map((s) => (
          <li key={s} style={{ fontSize: 14, padding: '6px 0' }}>
            <span style={{ color: 'var(--accent)', marginRight: 8 }}>✓</span>
            {SCOPE_LABELS[s] ?? s}
          </li>
        ))}
      </ul>
      <form method="POST" action="/api/oauth/authorize" style={{ display: 'flex', gap: 10 }}>
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="scope" value={requestedScopes.join(' ')} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="resource" value={resource} />
        <button type="submit" name="decision" value="approve" className="btn btn-accent">
          Authorize
        </button>
        <button type="submit" name="decision" value="deny" className="btn btn-ghost">
          Deny
        </button>
      </form>
    </main>
  )
}
