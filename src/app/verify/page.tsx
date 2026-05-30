'use client'

import { useCallback, useRef, useState } from 'react'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  VOIDED: 'bg-yellow-100 text-yellow-700',
}

interface ChainResult {
  ok: boolean
  brokenAtSeq?: number
  head?: string
  count: number
}

interface VerifyResponse {
  matched: boolean
  envelopeId?: string
  subject?: string
  status?: string
  completedAt?: string | null
  documentName?: string
  chain?: ChainResult
}

function shortHash(hash: string): string {
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash
}

export default function VerifyPage() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const verify = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setFileName(file.name)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/verify', { method: 'POST', body: form })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || `Verification failed (${res.status})`)
      }
      setResult((await res.json()) as VerifyResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) verify(file)
    },
    [verify]
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) verify(file)
    },
    [verify]
  )

  const matched = result?.matched && result.chain
  const intact = matched && result.chain?.ok

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Verify a document</h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Upload a sealed SwiftSign PDF to confirm it is genuine and that its audit trail has
          not been altered. Nothing you upload is stored.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onPick}
        />
        <p className="text-sm font-medium text-gray-900">
          {loading ? 'Verifying…' : 'Drop a sealed PDF here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {fileName && !loading ? fileName : 'or click to choose a file'}
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {result && !matched && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-800">No matching document</h2>
          <p className="text-sm text-amber-700 mt-1">
            This file does not match any document sealed by SwiftSign. It may have been modified
            after signing, or it was never processed here. Possible tampering — do not rely on it.
          </p>
        </div>
      )}

      {matched && (
        <div className="mt-6 space-y-4">
          <div
            className={`rounded-xl border p-5 ${
              intact ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <h2 className={`font-semibold ${intact ? 'text-green-800' : 'text-red-800'}`}>
              {intact ? 'Document integrity verified ✓' : 'Audit chain broken — possible tampering'}
            </h2>
            <p className={`text-sm mt-1 ${intact ? 'text-green-700' : 'text-red-700'}`}>
              {intact
                ? `Audit chain intact — ${result.chain!.count} event${
                    result.chain!.count !== 1 ? 's' : ''
                  } recorded.`
                : `The audit chain failed verification at event #${result.chain!.brokenAtSeq}. This document's history cannot be trusted.`}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Subject</dt>
                <dd className="font-medium text-gray-900 text-right">{result.subject}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Document</dt>
                <dd className="font-medium text-gray-900 text-right">{result.documentName}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      STATUS_COLORS[result.status ?? ''] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {result.status}
                  </span>
                </dd>
              </div>
              {result.completedAt && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Completed</dt>
                  <dd className="font-medium text-gray-900 text-right">
                    {new Date(result.completedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
              )}
              {intact && result.chain?.head && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Head hash</dt>
                  <dd className="font-mono text-xs text-gray-700 text-right break-all">
                    {shortHash(result.chain.head)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </main>
  )
}
