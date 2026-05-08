'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
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
    <html>
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fcfcfd',
          color: '#0a0b0d',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            We&apos;ve been notified and are looking into it. Please try again.
          </p>
          {error.digest ? (
            <p
              style={{
                color: '#94a3b8',
                fontSize: 12,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, monospace',
                marginBottom: 24,
              }}
            >
              error id: {error.digest}
            </p>
          ) : null}
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
      </body>
    </html>
  )
}
