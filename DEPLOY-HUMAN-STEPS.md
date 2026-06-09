# SwiftSign production deploy — human / external steps

The `production-hardening` branch makes the code enterprise-grade. These steps are the things code can't do — they need a human in a console, a vendor, or an irreversible op. Do them before/at go-live.

## Critical (security) — do first

1. **Rotate the leaked API key + purge git history.** `sk_live_ROTATED_REDACTED` was committed historically (working-tree copies are already scrubbed). Treat it as burned:
   - Rotate: issue a fresh key (dashboard → Settings, or run the backfill which preserves existing keys — but the old literal must be revoked). Update `.natalie/.secrets.env` (`SWIFTSIGN_API_KEY`) and anything using it.
   - Purge from history (irreversible, force-push): on a fresh mirror clone, `git filter-repo --replace-text <(printf 'sk_live_ROTATED_REDACTED==>REDACTED')`, then `git push --force --all && git push --force --tags`. Every other clone must re-clone. (Note: GitHub may cache; rotation is the real fix.)
2. **`sudo chown -R 501:20 ~/.npm`** — the npm content cache is corrupt (root-owned from a past `sudo npm`); it served truncated tarballs during this build. Until fixed, every `npm install` here risks re-corruption.

## Signing certificate (the one thing code can't produce)

3. **Buy a publicly-trusted document-signing cert.** A software/exportable PKCS#12 (.p12) "Document Signing" cert from GlobalSign / DigiCert / Sectigo (NOT an eToken/HSM-only SKU). It chains to roots Adobe already trusts, so signatures show valid without AATL enrollment.
   - `base64 -i cert.p12 | pbcopy` → set Vercel Production env `P12_CERT_BASE64` + `P12_CERT_PASSWORD`.
   - Until it arrives, prod uses the bundled self-signed cert (Acrobat shows "valid, signer unknown" — green integrity, yellow trust). Swapping the env var flips it fully trusted, zero code change.

## Stripe go-live

4. Create **Pro** ($15/mo) + **Team** ($79/mo) products + recurring prices → set `STRIPE_PRICE_PRO_MONTHLY` (+ `_TEAM_` if selling Team self-serve) in Vercel.
5. Set live `STRIPE_SECRET_KEY` (`sk_live_…`) — **request live-charge approval early** (Stripe review takes days; test mode unblocks all dev).
6. Add webhook endpoint `https://swiftsign.ca/api/stripe/webhook`, subscribe to `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`, `invoice.paid`, `invoice.payment_action_required` → set `STRIPE_WEBHOOK_SECRET`.
7. Enable **Stripe Tax** (Settings → Tax) + configure the **Customer Portal**.

## Vercel env (Production)

8. Set all required: rotated key, `P12_CERT_BASE64`/`P12_CERT_PASSWORD`, **`SENTRY_DSN` (now required in prod — boot fails without it)**, Stripe (above), `TSA_URL` (default DigiCert is fine), `CRON_SECRET` (≥16 chars, high-entropy), R2/Neon/Upstash/Resend.
9. **Unset `ALLOWED_LOGIN_EMAILS`** to open public self-serve signup (leave set to stay invite-gated).

## Database (prod = Neon)

10. Apply migrations: `DATABASE_URL=<prod> npx prisma migrate deploy`.
11. Run once after deploy: `npx tsx scripts/backfill-api-keys.ts` (migrate legacy keys → hashed table so they keep working) and `npx tsx scripts/seed-consent.ts` (seed the active ESIGN disclosure — signing is blocked without it).
12. **Enable Neon Point-in-Time Restore** (7-day min; 30 if budget allows) — console setting, legal-retention matters here.

## Storage (Cloudflare R2)

13. Enable **bucket versioning** on the `swiftsign` bucket (protects sealed PDFs + certs from overwrite/delete) + a lifecycle rule (retain noncurrent 90d; abort incomplete multipart after 7d).

## Observability

14. Stand up a hosted uptime monitor on `https://swiftsign.ca/api/healthcheck` (Better Stack / UptimeRobot) + a public **status page** at `status.swiftsign.ca`.
15. Configure Sentry alert rules (error-rate spike, new-issue, seal/webhook failures).

## Publish (when ready)

16. `cd mcp && npm publish` (`swiftsign-mcp@0.3.0`); `cd sdk-js && npm publish` (`swiftsign`); `cd sdk-python && python -m build && twine upload dist/*` (`swiftsign`). **Claim the npm + PyPI `swiftsign` names early.**

## Deferred until a real enterprise customer requires it (do NOT do on spec)

SOC 2 Type II (~$30-50k, 6-12mo), ISO 27001, HIPAA BAA, 21 CFR Part 11, eIDAS QES (needs a QTSP), independent pen test, cyber/E&O insurance, AATL program enrollment, multi-seat TEAM (orgs/RBAC/SSO).
