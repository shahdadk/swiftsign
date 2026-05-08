'use client'

import { useState } from 'react'

export function CheckoutButton({
  plan,
  label,
}: {
  plan: 'PRO' | 'TEAM'
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Checkout failed')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={go}
        disabled={loading}
        className="w-full h-10 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Redirecting…' : label}
      </button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </>
  )
}

export function PortalButton() {
  const [loading, setLoading] = useState(false)

  async function go() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Portal failed')
      }
      window.location.href = data.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={go}
      disabled={loading}
      className="h-9 px-4 rounded-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
    >
      {loading ? 'Loading…' : 'Manage subscription'}
    </button>
  )
}
