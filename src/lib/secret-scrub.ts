/**
 * Deep-scrubs secret-shaped substrings out of any value before it leaves the
 * process (Sentry events, structured logs). Pure, dependency-free, runs in both
 * the Node and Edge runtimes.
 *
 * Replaces matched substrings with `[redacted]` inside ANY string it finds while
 * recursing objects and arrays. Non-strings pass through untouched. Cycles are
 * guarded with a WeakSet and recursion is depth-capped, so a hostile or
 * self-referential payload can't blow the stack.
 */

const REDACTED = '[redacted]'
const MAX_DEPTH = 12

// Order matters: the Bearer rule keeps the literal word "Bearer" and only
// redacts the token after it.
const PATTERNS: RegExp[] = [
  /sk_(?:live|test)_[A-Za-z0-9]+/g, // Stripe secret keys
  /whsec_[A-Za-z0-9]+/g, // Stripe webhook secrets
  /re_[A-Za-z0-9_]+/g, // Resend API keys
  /(Bearer\s+)[A-Za-z0-9._-]+/g, // Authorization bearer tokens (keep "Bearer ")
]

function scrubString(s: string): string {
  let out = s
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (_match, prefix: unknown) =>
      // For patterns with a capture group ($1, e.g. "Bearer "), the captured
      // string arrives as a string and we preserve it. For patterns without a
      // group, replace() passes the match offset (a number) here instead, so we
      // must check the type rather than truthiness.
      typeof prefix === 'string' ? `${prefix}${REDACTED}` : REDACTED
    )
  }
  return out
}

function walk<T>(value: T, depth: number, seen: WeakSet<object>): T {
  if (typeof value === 'string') {
    return scrubString(value) as T
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  if (depth >= MAX_DEPTH) {
    return value
  }

  const obj = value as object
  if (seen.has(obj)) {
    return value
  }
  seen.add(obj)

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1, seen)) as T
  }

  const clone: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>)) {
    clone[key] = walk((value as Record<string, unknown>)[key], depth + 1, seen)
  }
  return clone as T
}

export function scrubSecrets<T>(value: T): T {
  return walk(value, 0, new WeakSet<object>())
}
