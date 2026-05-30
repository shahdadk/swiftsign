# SwiftSign: "Replace DocuSign for developers" readiness

Date: 2026-05-30. Author: gap audit (5 parallel audits + synthesis + adversarial critique), with every load-bearing claim re-verified on disk by the parent session. Calibrated for AI-assisted coding speed.

## One-line answer

There is no fundamental reason the software cannot get there. Code is not the bottleneck. What actually stops "replace DocuSign" is legal defensibility, signer-identity assurance, trust certifications, and buyer trust. Those are bought with time, money, and standing liability, not a sprint. The strategic trap is the framing itself: matching a public company feature-for-feature on one side and a free AGPL clone (Documenso, 12k+ stars) on the other, with no pricing power. Win the one seam both are weak in: the e-sign primitive an AI agent calls.

## Verdict: core is deployed and solid, local checkout drifted, the crypto-seal is the real upgrade

## What already works (verified)

- `swiftsign-mcp` published live on npm (v0.2.0). DocuSign ships no first-party MCP; BoldSign now ships `@boldsign/mcp`, so the bare "we have an MCP" is table stakes, but a flat-priced independent signing primitive built for the agent loop is not.
- Stripe-style timestamped HMAC-SHA256 webhook signatures (`t=`, `v1=`).
- Real webhook retry with persistence: 6 attempts, exp backoff 1m/5m/30m/2h/12h/24h, cron-driven, `WebhookDelivery` rows tracked. Replay protection via unique `eventId` + timestamp staleness window.
- Correct multi-tenant isolation: every v1 route + dashboard query scopes by `userId`; signer-token routes cross-check `document.envelopeId === recipient.envelopeId`. One API key cannot read another tenant's envelopes.
- Plan-aware sliding-window rate limiting with `X-RateLimit-*` + `Retry-After`, 429 on overflow.
- Routing-order signing, Zod-validated envelope create, R2 upload + page render + anchor resolution in a transaction.
- Certificate of Completion capturing IP / timestamp / method / SHA-256 hash with ESIGN/UETA/Ontario ECA notice (but see caveat: the audit rows that feed it are written by the sign route, which is missing from the local working tree).
- Stripe webhook verification done correctly. Sentry with `sendDefaultPii:false`. Fail-closed Zod env config. Signing p12/key/crt correctly gitignored (different secret from the leaked API key).

## Tier 0 — un-break the local repo (today, ~1-2h, pure code/ops)

1. `git restore 'src/app/api/sign/[token]/route.ts' 'src/app/api/sign/[token]/decline/route.ts'` (files intact at HEAD, missing from working tree). No filter-repo/fsck needed; ODB is healthy.
2. Rotate `sk_live_shahdad_swiftsign_2026`. Remove from `seed.ts` + the 4 scripts (read `process.env` only, no fallback literal). Purge from history (BFG / git-filter-repo).
3. Restrict `SKIP_ENV_VALIDATION` so stub creds can never apply when `NODE_ENV==='production'`.

## Tier 1 — legally tighter in a weekend (~2-4 days AI-assisted code, + 1 procurement item ordered in parallel)

Goal: move from "fill-and-flatten PDF + hash" to a cryptographically verifiable, defensibly-binding US/CA signature.

- Real PAdES sealing: add `node-signpdf` + `node-forge` (or pkijs), embed an ETSI.CAdES.detached PKCS#7 signature, actually load `P12_CERT_PATH`/`P12_CERT_PASSWORD` (today read nowhere).
- RFC-3161 trusted timestamp at seal time (free public TSAs exist: DigiCert/Sectigo). Replaces self-asserted `new Date()` server clock.
- Persist consent + intent server-side: full ESIGN consumer disclosure (hardware/software reqs + withdrawal mechanism), versioned, exact text stored, `ESIGN_CONSENT_ACCEPTED` with IP/UA/timestamp.
- SMS/email OTP before document access (Twilio Verify) + per-recipient access code, recorded as an auth event on the certificate.
- Replace `signingToken` `cuid()` with `crypto.randomBytes(32)` hex + single-use + expiry (the codebase already does CSPRNG for magic links).
- Hash API keys at rest (SHA-256, constant-time compare), move to a multi-key table with scopes/expiry/last-used.
- Render the DB audit log into the Certificate as a chronological trail. Add a public hash-verification page. Hash-chain the audit rows (WORM-style) so the trail is tamper-evident.
- SSRF guard on outbound webhook delivery (block private/link-local). Make rate limiting fail-CLOSED on auth/sign/create.

Caveat to state plainly: with a self-signed cert (current `certs/swiftsign.p12`, issuer==subject), the PAdES signature is cryptographically PRESENT and self-verifiable but still shows "validity unknown" in Adobe until a publicly-trusted (ideally AATL-listed) CA issues the cert. That cert is a vendor process measured in weeks, not a same-day order. The weekend deliverable is "cryptographically real," not "Adobe-green on Monday."

## Tier 2 — credible developer API (~1-2 weeks AI-assisted, + permanent SDK/sandbox maintenance tax)

- Templates resource (document + field layout + recipient roles, send-by-role). Biggest missing surface.
- Embedded signing: short-lived per-recipient signing URLs + a published React/Vue embed component.
- Sandbox/test mode: watermarked, explicitly non-binding, test-only keys, no quota burn.
- `Idempotency-Key` on POST /v1/envelopes (easy differentiator; DocuSign/Dropbox lack a clean one).
- Cursor pagination + filtering on list endpoints (currently unbounded).
- OpenAPI 3 from existing Zod schemas (zod-to-openapi), then auto-gen JS/TS + Python SDKs.
- Stable machine-readable error codes + documented table (currently ad-hoc `{ error: string }`).
- Bulk send (async job + status). Add radio/dropdown/attachment field types (6 of ~14 today).
- Expose webhook + API-key management under /api/v1 (currently cookie-session only) for self-serve.
- Widen the MCP lead: template-send, embedded-URL, status/remind/revoke/bulk tools.
- Timed public quickstart (sandbox key -> curl POST -> sign -> webhook on one screen) + webhook inspector with resend.

## Tier 3 — enterprise trust (months + real money + liability, NOT code — do NONE on spec)

- SOC 2 Type II: ~$30-50k all-in, 6-12 month observation window (Vanta/Drata).
- ISO 27001, independent annual pen test (shareable letter), HIPAA BAA, 21 CFR Part 11 (CSV/IQ-OQ-PQ).
- eIDAS AES/QES via a QTSP partnership on the EU Trusted List. QES cannot be self-issued. Refuse this segment for now.
- CA/AATL signing cert, RFC-3161 TSA contract, cyber/E&O insurance, DPA + subprocessor list, 99.9% SLA + status page + on-call.
- Org/team data model + SSO/SAML + RBAC (the advertised TEAM plan has no schema backing it).

Start exactly one of these only when a paying customer's contract requires it. Never before.

## Court-liability reality (as built today, pre-Tier-1)

Four concentrated weaknesses a competent litigator exploits if a SwiftSign-sealed contract is ever challenged:

1. Integrity rests on SwiftSign's OWN DB copy of the hash. No signature in the PDF, so a court-appointed examiner has no independent way to verify the doc wasn't altered. Opposing counsel attacks the custodian, not the math. A real PKCS#7/PAdES signature verifies offline by anyone.
2. Timestamps are self-asserted server clock with no RFC-3161 token. "When was this signed" is SwiftSign's word, impeachable for any time-sensitive contract.
3. Attribution is email + a `cuid()` token (timestamp+counter, partially predictable), not a CSPRNG. When a signer denies signing, the evidence is "a link went to this email and someone clicked."
4. Audit log is mutable DB rows, no hash-chain/WORM. The trail proving the event sequence is itself alterable by anyone with DB access.

Net: for an ordinary low-value B2B contract that never gets litigated, ESIGN/UETA/PIPEDA + the Certificate is probably enough. For anything that gets seriously challenged, the current build is materially weaker than DocuSign, and the weakness is exactly items 1-4 — three of which are CODE (in Tier 1), one of which is code + the cert procurement. Until Tier 1 ships: do NOT position SwiftSign for contracts where a dispute is foreseeable, and never above a modest dollar threshold.

## Narrowest wedge

`npm install swiftsign`, one MCP tool, one prompt ("send this PDF to alex@acme.com for signature"), and the agent sends, chases, and returns a sealed legal PDF without leaving Claude Code / Cursor / Zed. The seam both incumbents miss: DocuSign's moat is brand/certs/procurement (irrelevant to the first 100 indie/AI-native buyers; its agent play is sales-led enterprise), and Documenso's free AGPL self-host still makes the buyer stand up Postgres + signing certs + audit trail and take on copyleft risk. The defensible version is the independent, flat-priced ($15/$79, no per-envelope anxiety), one-install signing primitive built FOR the agent loop, with auto follow-up / stale-view pulse / completion-webhook-to-automation already built. Sell time-to-first-signature, never per-envelope price (Documenso self-host is $0; you have no floor to win on price).

Hard sequencing: the wedge promises "a sealed legal PDF from inside the agent." Today that PDF is flatten+hash with a decorative self-signed cert. The wedge is NOT honest to sell until Tier 1's real PAdES + consent capture lands. Ship Tier 1, then GTM. Not in parallel.

## The decision

Code is not your bottleneck. Distribution and the narrow wedge are. You have zero external customers today and the product mostly exists. After Tier 1, the highest-leverage build is not another API feature: it is getting the public `npm install` working for an outside dev and putting the agent-loop story in front of ten AI-native teams.
