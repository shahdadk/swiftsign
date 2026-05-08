'use client'

import { useState } from 'react'

export function ApiKeyCard({ initialKey }: { initialKey: string }) {
  const [apiKey, setApiKey] = useState(initialKey)
  const [revealed, setRevealed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const masked =
    apiKey.length > 10
      ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`
      : '(no key)'

  async function rotate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/account/api-key', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to rotate key')
      setApiKey(data.apiKey)
      setRevealed(true)
      setConfirming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="font-semibold text-gray-900 mb-1">API key</h2>
      <p className="text-sm text-gray-500 mb-3">
        Use this as a Bearer token in <code>Authorization</code> headers and as
        the <code>SWIFTSIGN_API_KEY</code> env var for the MCP server.
      </p>
      <div className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-sm font-mono break-all flex items-center justify-between gap-3">
        <span className="select-all flex-1">
          {revealed ? apiKey : masked}
        </span>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {revealed ? 'hide' : 'reveal'}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-red-600 hover:underline"
          >
            Regenerate key
          </button>
        ) : (
          <>
            <span className="text-sm text-gray-700">
              This invalidates the old key immediately. Continue?
            </span>
            <button
              onClick={rotate}
              disabled={loading}
              className="h-8 px-3 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Rotating…' : 'Yes, regenerate'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  )
}
