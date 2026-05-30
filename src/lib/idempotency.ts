import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { problem } from '@/lib/api-errors'

const TTL_MS = 24 * 60 * 60 * 1000

export function fingerprint(body: string): string {
  return crypto.createHash('sha256').update(body).digest('hex')
}

// Wraps a POST handler with idempotency keyed on the `Idempotency-Key` header.
// - No header -> just run the handler.
// - Header + first time -> claim the key (pending row), run, store the response.
// - Header + replay (same body, completed) -> return the stored response.
// - Header + different body -> 422 idempotency_key_reused.
// - Header + still in flight -> 409 idempotency_conflict.
// `rawBody` is the exact request body string (so the handler can reuse it
// without re-reading the stream).
export async function withIdempotency(
  request: Request,
  userId: string,
  rawBody: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const key = request.headers.get('idempotency-key')
  if (!key) return handler()

  const bodyHash = fingerprint(rawBody)

  const existing = await prisma.idempotencyKey.findUnique({
    where: { userId_key: { userId, key } },
  })

  if (existing) {
    if (existing.bodyHash !== bodyHash) return problem('idempotency_key_reused')
    if (existing.responseStatus == null) return problem('idempotency_conflict')
    return NextResponse.json(existing.responseBody, {
      status: existing.responseStatus,
    })
  }

  // Claim the key with a pending row. A concurrent claim loses the unique race.
  try {
    await prisma.idempotencyKey.create({
      data: {
        userId,
        key,
        bodyHash,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    })
  } catch {
    return problem('idempotency_conflict')
  }

  const res = await handler()

  // Persist the response for future replays (best-effort).
  try {
    const text = await res.clone().text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // non-JSON body — store the raw string (valid JSON)
    }
    await prisma.idempotencyKey.update({
      where: { userId_key: { userId, key } },
      data: {
        responseStatus: res.status,
        responseBody: parsed as object,
      },
    })
  } catch {
    // If persistence fails the response still returns; the next replay will
    // see a pending row and 409, which is the safe (non-duplicating) outcome.
  }

  return res
}
