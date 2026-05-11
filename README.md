# SwiftSign

AI-native e-signatures. Send, track, and seal contracts from your terminal — Claude Code, Cursor, Zed, or any MCP-aware agent. ESIGN / UETA / PIPEDA compliant sealed PDFs with audit trail.

## Stack

- Next.js 16.2 (App Router, Turbopack, React 19)
- Prisma 7 (preview) + Neon PostgreSQL via `@prisma/adapter-pg`
- Cloudflare R2 (S3-compatible) for PDFs + page images
- Resend for transactional email
- Stripe for billing (Free / Pro $15 / Team $79, monthly)
- Upstash Redis for rate limiting
- Sentry for error tracking

## Setup on a fresh machine

```bash
git clone https://github.com/shahdadk/swiftsign.git
cd swiftsign
./scripts/bootstrap.sh
```

The bootstrap script installs Vercel CLI, logs you in (browser auth), links the
checkout to the SwiftSign Vercel project, pulls production env vars into
`.env.local`, and runs `npm install`. After it finishes, run `npm run dev` and
you're operational.

## Manual local development

```bash
# Install (legacy-peer-deps is pinned in .npmrc, required for React 19 / Next 16)
npm install

# Generate the Prisma client (writes to src/generated/prisma/, gitignored)
npx prisma generate

# Apply schema migrations to your dev DB
npx prisma migrate deploy

# Run the dev server
npm run dev
```

Copy `.env.local.example` to `.env.local` and fill in the values, or run
`./scripts/bootstrap.sh` to pull them from Vercel.

## Commands

- `npm run dev` — start dev server on port 3000
- `npm run build` — production build (Turbopack)
- `npm run start` — run the built server
- `npm run lint` — ESLint
- `npx prisma generate` — regenerate the Prisma client
- `npx prisma migrate dev --name <slug>` — create a new migration
- `npx tsx prisma/seed.ts` — seed a local user (manual)

## Deploying to Vercel

1. **Provision services**:
   - Neon PostgreSQL database; copy the pooled connection string to `DATABASE_URL`.
   - Cloudflare R2 bucket; create an API token with read/write; copy account ID, access key ID, secret, bucket name.
   - Resend domain (verify DNS for the `EMAIL_FROM` domain) and an API key.
   - Stripe products: SwiftSign Pro ($15/mo recurring), SwiftSign Team ($79/mo recurring); copy price IDs. Enable Stripe Tax if collecting GST/HST/VAT. Set the customer portal return URL to `https://swiftsign.ca/dashboard/billing` and enable cancel + payment-method update.
   - Stripe webhook endpoint: `https://swiftsign.ca/api/stripe/webhook`, listening for `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. Copy the signing secret.
   - Upstash Redis instance for rate limiting; copy REST URL and token.
   - Sentry project (Next.js); copy the DSN.
   - Generate a `CRON_SECRET` (16+ random chars). Vercel cron will pass this as `Authorization: Bearer <CRON_SECRET>`.

2. **Set environment variables** on the Vercel project (Production + Preview). See `.env.local.example` for the full list.

3. **Deploy**: connect the repo, push to `main`. Vercel runs `npx prisma generate` and `next build` from `package.json`.

   Run schema migrations once via `npx prisma migrate deploy` — locally, or as part of a build hook. Subsequent deploys re-apply automatically if you wire it into the build command.

4. **Verify**: visit `/api/healthcheck`. Returns `{ status: "ok" }` with DB and R2 checks green.

## Architecture

- `/api/v1/envelopes` — public REST API; bearer-token auth via `Authorization: Bearer <apiKey>`. Quota enforced (5/mo on Free, unlimited on Pro/Team).
- `/sign/[token]` + `/api/sign/[token]` — recipient signing flow. No account; `signingToken` is the only credential.
- `/dashboard/*` — sender UI. Cookie session via `swiftsign_session`. Pages: envelopes list, envelope detail, billing, settings (API key + sessions), webhooks.
- `/api/stripe/webhook` — Stripe → DB sync (subscription + plan).
- `/api/cron/webhook-retry` — runs every 5 minutes via `vercel.json` to retry failed outbound webhook deliveries.

## MCP server

Independent npm package at `mcp/`. Build + publish:

```bash
cd mcp
npm install
npm run build
npm publish
```

Users install with:

```bash
claude mcp add swiftsign -- npx -y swiftsign-mcp
```

Configure with `SWIFTSIGN_API_KEY` (and optionally `SWIFTSIGN_API_URL` for self-hosted instances).
