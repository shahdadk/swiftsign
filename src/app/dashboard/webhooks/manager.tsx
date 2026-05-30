'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/copy-button'

const EVENTS = [
  'envelope.sent',
  'envelope.viewed',
  'envelope.signed',
  'envelope.completed',
  'envelope.declined',
  'envelope.voided',
] as const

type Endpoint = {
  id: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
}

export function WebhooksManager({ initial }: { initial: Endpoint[] }) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState<string[]>([
    'envelope.sent',
    'envelope.signed',
    'envelope.completed',
  ])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<{
    id: string
    secret: string
  } | null>(null)

  async function create() {
    if (!url) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/account/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: selected, isActive: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create endpoint')

      setEndpoints((prev) => [
        {
          id: data.id,
          url: data.url,
          events: data.events,
          isActive: data.isActive,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setRevealedSecret({ id: data.id, secret: data.secret })
      setUrl('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/account/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    setEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isActive } : e))
    )
  }

  async function remove(id: string) {
    if (!confirm('Delete this endpoint?')) return
    await fetch(`/api/account/webhooks/${id}`, { method: 'DELETE' })
    setEndpoints((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <>
      {/* One-time secret reveal. SwiftSign generates the secret at endpoint
          creation; this is the only time the cleartext value is exposed. */}
      {revealedSecret && (
        <div
          className="dev-card"
          style={{
            background: 'rgba(245, 158, 11, 0.06)',
            borderColor: 'rgba(245, 158, 11, 0.25)',
            marginBottom: 24,
          }}
        >
          <div className="eyebrow" style={{ color: '#b45309', marginBottom: 8 }}>
            Save this · shown once
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 12 }}>
            Copy your signing secret now and paste it into your service. We
            don&apos;t store the cleartext value — you can&apos;t retrieve it later.
          </p>
          <pre
            className="dev-card-code mono"
            style={{ position: 'relative', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
          >
            <code>{revealedSecret.secret}</code>
            <span style={{ position: 'absolute', top: 12, right: 12 }}>
              <CopyButton value={revealedSecret.secret} variant="inline" />
            </span>
          </pre>
          <button
            onClick={() => setRevealedSecret(null)}
            className="btn-link"
            style={{ marginTop: 12 }}
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          Endpoints
        </h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            New endpoint
          </button>
        )}
      </div>

      {showForm && (
        <div className="dev-card" style={{ marginBottom: 24 }}>
          <label
            htmlFor="webhook-url"
            className="eyebrow"
            style={{ display: 'block', marginBottom: 6 }}
          >
            URL
          </label>
          <input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/swiftsign"
            className="mono"
            style={{
              width: '100%',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)',
              padding: '10px 12px',
              fontSize: 13,
              marginBottom: 20,
              background: 'var(--surface)',
            }}
          />

          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Events
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {EVENTS.map((ev) => (
              <label
                key={ev}
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(ev)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, ev]
                        : prev.filter((x) => x !== ev)
                    )
                  }}
                />
                <code>{ev}</code>
              </label>
            ))}
          </div>

          {error && (
            <p
              style={{
                fontSize: 13,
                color: '#b91c1c',
                marginBottom: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={create}
              disabled={creating || !url || selected.length === 0}
              className="btn btn-primary"
              style={{ opacity: creating || !url || selected.length === 0 ? 0.6 : 1 }}
            >
              {creating ? 'Creating…' : 'Create endpoint'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {endpoints.length === 0 && !showForm ? (
        <div className="env-empty">
          <div># no endpoints yet</div>
          <div style={{ marginTop: 6 }}>
            <span>add one to start receiving callbacks.</span>
          </div>
        </div>
      ) : (
        <div className="env-grid">
          {endpoints.map((ep) => (
            <div key={ep.id} className="env-card">
              <div className="env-card-head">
                <div className="env-card-title">
                  <h3 style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
                    {ep.url}
                  </h3>
                  <p className="env-card-docs">
                    {ep.events.length} event{ep.events.length !== 1 ? 's' : ''} ·{' '}
                    {new Date(ep.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className="env-card-actions"
                  style={{ flexShrink: 0 }}
                >
                  <label
                    className="mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ep.isActive}
                      onChange={(e) => toggle(ep.id, e.target.checked)}
                    />
                    active
                  </label>
                  <button
                    onClick={() => remove(ep.id)}
                    className="btn-link"
                    style={{ color: '#b91c1c' }}
                  >
                    delete
                  </button>
                </div>
              </div>
              <div className="env-chips">
                {ep.events.map((ev) => (
                  <code key={ev} className="env-chip">
                    {ev}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verifying signatures — docs block. .dev-card for the same surface
          treatment as the cards above. */}
      <div className="dev-card" style={{ marginTop: 32 }}>
        <div className="dev-card-head">
          <span className="dev-card-icon" aria-hidden>
            🔐
          </span>
          <span className="dev-card-kicker mono">HMAC-SHA256</span>
        </div>
        <h3>Verifying signatures</h3>
        <p style={{ color: 'var(--ink-3)', fontSize: 13.5, marginBottom: 14 }}>
          Each delivery carries{' '}
          <code className="inline-code">
            SwiftSign-Signature: t=&lt;ts&gt;,v1=&lt;hex&gt;
          </code>
          . Compute{' '}
          <code className="inline-code">
            HMAC_SHA256(secret, &lt;ts&gt; + &quot;.&quot; + raw body)
          </code>{' '}
          and compare in constant time.
        </p>
        <pre className="dev-card-code mono" style={{ position: 'relative' }}>
          <code>
{`const sig = req.headers['swiftsign-signature']
const [tPart, v1Part] = sig.split(',')
const ts = tPart.split('=')[1]
const v1 = v1Part.split('=')[1]
const expected = crypto.createHmac('sha256', SECRET)
  .update(\`\${ts}.\${rawBody}\`).digest('hex')
const ok = crypto.timingSafeEqual(
  Buffer.from(v1, 'hex'),
  Buffer.from(expected, 'hex')
)`}
          </code>
          <span style={{ position: 'absolute', top: 12, right: 12 }}>
            <CopyButton
              variant="inline"
              value={`const sig = req.headers['swiftsign-signature']
const [tPart, v1Part] = sig.split(',')
const ts = tPart.split('=')[1]
const v1 = v1Part.split('=')[1]
const expected = crypto.createHmac('sha256', SECRET)
  .update(\`\${ts}.\${rawBody}\`).digest('hex')
const ok = crypto.timingSafeEqual(
  Buffer.from(v1, 'hex'),
  Buffer.from(expected, 'hex')
)`}
            />
          </span>
        </pre>
      </div>
    </>
  )
}
