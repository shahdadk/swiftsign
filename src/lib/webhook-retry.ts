// Backoff schedule (in seconds): 1m, 5m, 30m, 2h, 12h, 24h
// Index = current attempt count (1-based), so backoffs[0] = wait after attempt 1.
const BACKOFFS_SEC = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60, 24 * 60 * 60]
export const MAX_ATTEMPTS = 6

export function nextAttemptAt(attempt: number): Date | null {
  if (attempt >= MAX_ATTEMPTS) return null
  const idx = Math.min(attempt - 1, BACKOFFS_SEC.length - 1)
  const sec = BACKOFFS_SEC[idx]
  return new Date(Date.now() + sec * 1000)
}
