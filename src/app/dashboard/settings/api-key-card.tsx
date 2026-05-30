'use client'

import { useState } from 'react'
import type { publicApiKeyView } from '@/lib/api-key'

type KeyView = ReturnType<typeof publicApiKeyView>

export function ApiKeyCard({ initialKeys }: { initialKeys: KeyView[] }) {
  const [keys, setKeys] = useState<KeyView[]>(initialKeys)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'LIVE' | 'TEST'>('LIVE')
  const [creating, setCreating] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/account/api-key')
    if (res.ok) {
      const data = await res.json()
      setKeys(data.keys)
    }
  }

  async function create() {
    setCreating(true)
    setError(null)
    setRevealedSecret(null)
    try {
      const res = await fetch('/api/account/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key')
      setRevealedSecret(data.secret)
      setName('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key immediately? This cannot be undone.')) return
    setError(null)
    try {
      const res = await fetch(`/api/account/api-key/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to revoke key')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key')
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="font-semibold text-gray-900 mb-1">API keys</h2>
      <p className="text-sm text-gray-500 mb-4">
        Use a key as a Bearer token in <code>Authorization</code> headers and as
        the <code>SWIFTSIGN_API_KEY</code> env var for the MCP server.
      </p>

      {revealedSecret && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Copy this key now — you won&apos;t see it again.
          </p>
          <div className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-sm font-mono break-all flex items-center justify-between gap-3">
            <span className="select-all flex-1">{revealedSecret}</span>
            <button
              onClick={() => navigator.clipboard.writeText(revealedSecret)}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              copy
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100 border-y border-gray-100">
        {keys.length === 0 && (
          <p className="text-sm text-gray-400 py-3">No API keys yet.</p>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {k.name || 'Untitled key'}
                </span>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    k.mode === 'LIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {k.mode}
                </span>
                {k.revokedAt && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    REVOKED
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">
                {k.prefix}…{k.last4}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {k.scopes.join(', ')}
                {' · '}
                {k.lastUsedAt
                  ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                  : 'never used'}
              </p>
            </div>
            {!k.revokedAt && (
              <button
                onClick={() => revoke(k.id)}
                className="text-sm text-red-600 hover:underline shrink-0"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (optional)"
          className="h-9 px-3 rounded-md border border-gray-300 text-sm flex-1 min-w-[10rem]"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'LIVE' | 'TEST')}
          className="h-9 px-3 rounded-md border border-gray-300 text-sm"
        >
          <option value="LIVE">Live</option>
          <option value="TEST">Test</option>
        </select>
        <button
          onClick={create}
          disabled={creating}
          className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  )
}
