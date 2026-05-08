'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div style={{ padding: 48, maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>Dashboard error</h2>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Something went wrong loading this page.
      </p>
      <button
        onClick={reset}
        style={{
          background: '#2b5cff',
          color: '#fff',
          border: 0,
          padding: '10px 20px',
          borderRadius: 6,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
