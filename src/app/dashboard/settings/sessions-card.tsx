'use client'

import { useState } from 'react'

export function SessionsCard() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function killAll() {
    if (!confirm('Sign out of every device immediately?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/account/sessions', { method: 'DELETE' })
      if (res.ok) {
        setDone(true)
        setTimeout(() => {
          window.location.href = '/dashboard/login'
        }, 500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-1">Sessions</h2>
      <p className="text-sm text-gray-500 mb-3">
        Sign out of all devices in case you suspect your account was used
        elsewhere.
      </p>
      <button
        onClick={killAll}
        disabled={loading || done}
        className="text-sm text-red-600 hover:underline disabled:opacity-60"
      >
        {done ? 'Signed out…' : loading ? 'Working…' : 'Sign out everywhere'}
      </button>
    </section>
  )
}
