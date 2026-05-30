// In-memory token bucket — the fail-CLOSED fallback for rate limiting when
// Upstash is unreachable. Per-process (serverless = per-warm-instance), which is
// fine as a degraded backstop: during a Redis outage it still throttles abuse
// instead of failing open and letting everything through.

interface Bucket {
  tokens: number
  refilledAt: number
}

const buckets = new Map<string, Bucket>()

// Returns true if a token was available (request allowed), false if throttled.
export function takeToken(
  key: string,
  capacity: number,
  refillPerSec: number
): boolean {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b) {
    b = { tokens: capacity, refilledAt: now }
    buckets.set(key, b)
  }
  const elapsedSec = (now - b.refilledAt) / 1000
  b.tokens = Math.min(capacity, b.tokens + elapsedSec * refillPerSec)
  b.refilledAt = now
  if (b.tokens >= 1) {
    b.tokens -= 1
    return true
  }
  // Opportunistic prune so the map can't grow unbounded under attack.
  if (buckets.size > 10000) pruneBuckets()
  return false
}

export function pruneBuckets(maxAgeMs = 10 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs
  for (const [k, b] of buckets) {
    if (b.refilledAt < cutoff) buckets.delete(k)
  }
}
