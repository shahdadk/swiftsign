import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { env } from './env'
import { logger } from './logger'

let cached: Redis | null = null

function redis(): Redis {
  if (cached) return cached
  cached = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
  return cached
}

type LimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Fail-open wrapper: if Upstash is unreachable (network failure, placeholder creds,
// or outage), allow the request through and log a warning. Better to slightly
// over-serve than to black-hole every request when our limiter is down.
function safeLimit(rl: Ratelimit, key: string, name: string) {
  return {
    async limit(k: string = key): Promise<LimitResult> {
      try {
        return await rl.limit(k)
      } catch (err) {
        logger.warn('Rate limiter unavailable, failing open', {
          limiter: name,
          err: err instanceof Error ? err.message : String(err),
        })
        return { success: true, limit: 0, remaining: 0, reset: 0 }
      }
    },
  }
}

export const authSendLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:auth-send',
    analytics: false,
  }),
  '',
  'authSend'
)

export const authVerifyLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:auth-verify',
    analytics: false,
  }),
  '',
  'authVerify'
)

export const signLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:sign',
    analytics: false,
  }),
  '',
  'sign'
)

const envelopeLimiterFree = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:envelope:free',
    analytics: false,
  }),
  '',
  'envelope:free'
)

const envelopeLimiterPro = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(100, '1 h'),
    prefix: 'rl:envelope:pro',
    analytics: false,
  }),
  '',
  'envelope:pro'
)

const envelopeLimiterTeam = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(1000, '1 h'),
    prefix: 'rl:envelope:team',
    analytics: false,
  }),
  '',
  'envelope:team'
)

export function envelopeLimiterFor(plan: 'FREE' | 'PRO' | 'TEAM') {
  if (plan === 'PRO') return envelopeLimiterPro
  if (plan === 'TEAM') return envelopeLimiterTeam
  return envelopeLimiterFree
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return '0.0.0.0'
}

export function rateLimitHeaders(r: LimitResult): Record<string, string> {
  const retryAfter = Math.max(0, Math.ceil((r.reset - Date.now()) / 1000))
  return {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.ceil(r.reset / 1000)),
  }
}
