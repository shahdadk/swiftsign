import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { env } from './env'
import { logger } from './logger'
import { takeToken } from './token-bucket'

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

// Fail-CLOSED wrapper: if Upstash is unreachable (network failure, placeholder
// creds, or outage), fall back to a per-process in-memory token bucket with
// tighter limits. A real outage still throttles abusers instead of opening the
// gates, while a transient blip doesn't black-hole legitimate single users.
function safeLimit(
  rl: Ratelimit,
  key: string,
  name: string,
  fallback: { capacity: number; refillPerSec: number } = {
    capacity: 5,
    refillPerSec: 5 / 60,
  }
) {
  return {
    async limit(k: string = key): Promise<LimitResult> {
      try {
        return await rl.limit(k)
      } catch (err) {
        logger.warn('Rate limiter unavailable, failing closed (memory fallback)', {
          limiter: name,
          err: err instanceof Error ? err.message : String(err),
        })
        const ok = takeToken(`${name}:${k}`, fallback.capacity, fallback.refillPerSec)
        return {
          success: ok,
          limit: fallback.capacity,
          remaining: ok ? Math.max(0, fallback.capacity - 1) : 0,
          reset: Date.now() + 60_000,
        }
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

// Per-IP limiter for the signer mutation routes — stops one IP brute-forcing
// many signing tokens.
export const signIpLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:sign-ip',
    analytics: false,
  }),
  '',
  'signIp',
  { capacity: 10, refillPerSec: 0.5 }
)

// OAuth dynamic client registration — open by design, so throttle per IP.
export const dcrLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:oauth-dcr',
    analytics: false,
  }),
  '',
  'oauthDcr',
  { capacity: 5, refillPerSec: 5 / 3600 }
)

// Anti-abuse: accounts younger than 7 days get a live-send velocity cap.
// Instant no-KYC keys + e-signature email is phishing infrastructure if left
// open; one spam wave blacklists the sending domain for every customer.
export const youngLiveSendLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(10, '24 h'),
    prefix: 'rl:young-live-send',
    analytics: false,
  }),
  '',
  'youngLiveSend',
  { capacity: 3, refillPerSec: 3 / 86_400 }
)

// Per-IP signup-velocity limiter — caps new-account creation from one IP now
// that signup is public.
export const signupVelocityLimiter = safeLimit(
  new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'rl:signup',
    analytics: false,
  }),
  '',
  'signup',
  { capacity: 3, refillPerSec: 3 / 3600 }
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
