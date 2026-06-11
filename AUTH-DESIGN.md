# SwiftSign auth — design decision (researched 2026-05-31)

Researched the MCP authorization spec (via claude-code-guide) + the broader agent/API
auth landscape + the e-signature legal-identity constraint. Decision below; sources at bottom.

## Headline

**Keep API keys as the primitive — but the agent mints and caches them itself.**
OAuth is the wrong default here: its job is *delegated third-party access* (a platform
acting on someone else's account). The dominant case — a developer (or their agent)
acting on its OWN SwiftSign account — is first-party M2M, where scoped API keys are
correct (Stripe/OpenAI/GitHub all do this). OAuth client-credentials would add JWT
ceremony without a different trust model, because the bootstrap secret is still long-lived.

## Provisioning (the agent-native core) — copy the Stripe CLI pattern

1. **Sandbox: `POST /v1/signup {email}` → instant `ss_test_` key.** No browser, no
   payment, email-deferred. This is the 90% case and already built. The agent provisions
   its own credential in one call.
2. **MCP / CLI first-run for live: device-pairing mint (Stripe CLI model; RFC 8628 is the
   standardized version).** The MCP, with no key, POSTs a `device_name` → gets back a
   verification code + browser URL → the human confirms the code once in-browser →
   SwiftSign mints a **scoped** key and returns it to the MCP, which caches it. The human
   never pastes a key. (Vercel made RFC 8628 its CLI default in Sept 2025.)
   - Mitigate the device-flow phishing weakness: short pairing-code TTL, show the
     requesting `device_name` + scope on the approval screen, bind approval to a
     logged-in dashboard session.
3. **Store the cached key in the OS keychain** (macOS Keychain / Windows Credential
   Manager / Linux Secret Service), NOT a `~/.swiftsign` dotfile. (gh's plaintext-dotfile
   fallback is a known, open security issue — don't repeat it.) Correction to an earlier
   call in this project: I'd said cache in `~/.swiftsign/`; the research says keychain.

## Key model (Stripe restricted-key grade — table stakes)

- Prefixes encoding env + type: **`ss_test_` / `ss_live_`**, restricted **`ssr_live_`** →
  enables secret-scanning + auto-revoke-on-leak. (We ship `sk_test_`/`sk_live_` today;
  rename to `ss_` to avoid collision with Stripe's `sk_` namespace.)
- Hash at rest, show once, last-4 after. **Done.**
- Scopes per resource (`documents:send`, `documents:read`, `templates:write`, …). **Done
  (envelopes:read/write); widen the vocabulary.**
- Expiry on device/agent keys (90-day default). Revocable from the dashboard without
  redeploy. Per-agent-instance keys + audit log recording agent identity + scope per call.
- A "key that mints keys" admin endpoint (OpenAI model) so an orchestrator can provision
  scoped child keys programmatically.

## The one deliberate gate: sandbox → live (the legal part)

Live mode binds a SENDER to a legally valid signature request, so the identity bar is
higher ON PURPOSE — the friction IS the legal attribution. Driven by ESIGN/UETA:

- **Verified email** — UETA explicitly recognizes an email address as a unique identifier
  that attributes a record to a person.
- **Payment method on file** — a real-world identity anchor (also why OpenAI/Stripe gate
  live keys behind billing).
- **Verified sender identity** (verified-domain from-address) so the request is legally
  attributable to a real entity.
- Per-document signer-verification ladder (email → SMS OTP → KBA → gov-ID), each recorded
  with timestamp + IP in the tamper-evident audit trail.

Sandbox stays near-anonymous + instant; live takes the two human touches (verify + pay).
Never a raw key in either path.

## MCP-server auth specifically

- Local (stdio) MCP we ship today: the device-pairing-minted scoped key in the keychain is
  the right call — simpler than running an OAuth Authorization Server, and it's the proven
  CLI pattern.
- If SwiftSign is ever exposed as a REMOTE/hosted MCP server: follow the MCP spec — OAuth
  2.1 + PKCE + Resource Indicators (RFC 8707) + protected-resource metadata. **But the
  2025-11-25 spec walked BACK Dynamic Client Registration (DCR) → use Client ID Metadata
  Documents (CIMD) or pre-registration, not DCR.**

## Don't

- Don't switch the core to OAuth (wrong tool for first-party agents).
- Don't build MCP auth on DCR (deprecated in the Nov 2025 spec).
- Don't cache the key in a plaintext dotfile (use the keychain).
- Don't block on agent-identity standards (WIMSE / SPIFFE / AAuth) — pre-production in
  2026; ship scoped keys now, leave a clean seam.

## Onboarding surfaces — target model (reference: Higgsfield, 2026-05-31)

Three toggled install paths, per-agent tabs (Claude / Cursor / Codex / …), ZERO key-pasting
anywhere on the page. This is the productized form of the device-login decision above.

- **CLI (the keystone, terminal-agent path):** `npm i -g @swiftsign/cli`, then
  `swiftsign auth login` → opens a browser (device-pairing, RFC 8628) → mints a scoped key
  and stores it in the OS keychain. "Auth, uploads, polling handled for you." This is the
  Claude Code / Codex path. We have NO CLI today — build this first.
- **MCP (remote/hosted, desktop-app path):** a hosted connector at `mcp.swiftsign.ca/mcp`,
  added in Claude → Settings → Connectors → Connect → OAuth sign-in. Bigger build (host the
  MCP over HTTP + implement MCP OAuth 2.1 + resource indicators, CIMD not DCR). Higgsfield's
  own note: for Claude Code/Codex, prefer the CLI.
- **Skill:** `npx skills add swiftsign-ai/skills`.

Onboarding page mirrors this 3-tab layout and REPLACES the current key-centric `/docs` hero
(resolves F-001 + F-002). Build order: `swiftsign auth login` CLI → 3-tab page → remote MCP
→ skill.

## Sources

MCP spec (2025-11-25 authorization), Auth0 (June/Nov 2025 MCP auth updates), Aaron Parecki
(DCR→CIMD), AWS open-protocols MCP auth; Stripe (keys, restricted keys, CLI login, agents-
can-pay), Stripe CLI login teardown (Ben Tranter), Descope (OAuth vs API keys for agents),
WorkOS (API keys vs M2M), Logto (CLI auth methods), RFC 8628 / 7591 / 8707, Vercel CLI
device-flow changelog, gh plaintext-storage issues, OpenAI admin-key API; ESIGN/UETA
attribution (Ironclad, SignWell), DocuSign identity-verification ladder, GitGuardian + IETF
draft-klrc-aiagent-auth-00 (agent identity).
