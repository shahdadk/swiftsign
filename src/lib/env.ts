import { z } from 'zod'

const ServerSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().url().optional(),

  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(1),

  // Stripe is optional — if all four are absent, billing UI is hidden and
  // routes return 503. Set them to enable billing later.
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().startsWith('price_').optional(),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  SENTRY_DSN: z.string().url().optional(),

  CRON_SECRET: z.string().min(16),

  NEXT_PUBLIC_APP_URL: z.string().url(),

  P12_CERT_PATH: z.string().optional(),
  P12_CERT_PASSWORD: z.string().optional(),

  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // Comma-separated allowlist of emails permitted to sign in.
  // If unset, signup is open to anyone. Set this to gate the magic-link flow
  // for closed-beta / internal-use deployments.
  ALLOWED_LOGIN_EMAILS: z.string().optional(),
})

type ServerEnv = z.infer<typeof ServerSchema>

const stub: ServerEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://stub:stub@localhost:5432/stub',
  R2_ACCOUNT_ID: 'stub',
  R2_ACCESS_KEY_ID: 'stub',
  R2_SECRET_ACCESS_KEY: 'stub',
  R2_BUCKET_NAME: 'stub',
  R2_ENDPOINT: undefined,
  RESEND_API_KEY: 're_stub',
  EMAIL_FROM: 'stub@example.com',
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  STRIPE_PRICE_PRO_MONTHLY: undefined,
  STRIPE_PRICE_TEAM_MONTHLY: undefined,
  UPSTASH_REDIS_REST_URL: 'https://stub.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'stub',
  SENTRY_DSN: undefined,
  CRON_SECRET: 'stub-stub-stub-stub',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  P12_CERT_PATH: undefined,
  P12_CERT_PASSWORD: undefined,
  WEBHOOK_TIMEOUT_MS: 5000,
  ALLOWED_LOGIN_EMAILS: undefined,
}

function loadEnv(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION === '1') return stub

  const parsed = ServerSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Set SKIP_ENV_VALIDATION=1 to bypass (CI/build only).`
    )
  }
  return parsed.data
}

export const env = loadEnv()

export const billingEnabled =
  !!env.STRIPE_SECRET_KEY &&
  !!env.STRIPE_WEBHOOK_SECRET &&
  !!env.STRIPE_PRICE_PRO_MONTHLY &&
  !!env.STRIPE_PRICE_TEAM_MONTHLY

export const loginAllowlist: string[] | null = env.ALLOWED_LOGIN_EMAILS
  ? env.ALLOWED_LOGIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : null

export const signupOpen = loginAllowlist === null

export function isEmailAllowed(email: string): boolean {
  if (loginAllowlist === null) return true
  return loginAllowlist.includes(email.trim().toLowerCase())
}
