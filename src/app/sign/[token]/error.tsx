'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function SignError({
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>
          We couldn&apos;t load this signing session
        </h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>
          Please try again. If the problem persists, contact the sender.
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
    </div>
  )
}
