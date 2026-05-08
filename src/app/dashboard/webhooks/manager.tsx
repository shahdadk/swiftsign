'use client'

import { useState } from 'react'

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
      {revealedSecret && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Save your signing secret. This is the only time it will be shown.
          </p>
          <div className="bg-gray-900 text-amber-300 rounded-lg px-3 py-2 text-xs font-mono break-all select-all">
            {revealedSecret.secret}
          </div>
          <button
            onClick={() => setRevealedSecret(null)}
            className="text-sm text-amber-700 hover:underline mt-3"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Endpoints</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            New endpoint
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/swiftsign"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <p className="text-sm font-medium text-gray-900 mb-2">Events</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {EVENTS.map((ev) => (
              <label
                key={ev}
                className="flex items-center gap-2 text-sm text-gray-700"
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
                <code className="text-xs">{ev}</code>
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={create}
              disabled={creating || !url || selected.length === 0}
              className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="h-9 px-4 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {endpoints.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            No endpoints yet. Add one to start receiving callbacks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 break-all">
                    {ep.url}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {ep.events.length} event
                    {ep.events.length !== 1 ? 's' : ''} ·{' '}
                    {new Date(ep.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={ep.isActive}
                      onChange={(e) => toggle(ep.id, e.target.checked)}
                    />
                    Active
                  </label>
                  <button
                    onClick={() => remove(ep.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ep.events.map((ev) => (
                  <code
                    key={ev}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                  >
                    {ev}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          Verifying signatures
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Each delivery carries{' '}
          <code className="text-xs bg-gray-200 px-1 rounded">
            SwiftSign-Signature: t=&lt;ts&gt;,v1=&lt;hex&gt;
          </code>
          . Compute{' '}
          <code className="text-xs bg-gray-200 px-1 rounded">
            HMAC_SHA256(secret, &lt;ts&gt; + &quot;.&quot; + raw body)
          </code>{' '}
          and compare.
        </p>
        <pre className="bg-gray-900 text-green-400 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">
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
        </pre>
      </div>
    </>
  )
}
