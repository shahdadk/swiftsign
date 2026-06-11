# SwiftSign — product friction log

A compounding backlog of the moments a user (founder, developer, or agent) hit
confusion or a wall. The most valuable product signal is a smart user getting
confused — captured the instant it happens, ranked, each one a candidate fix.
Maintained by the `product-friction` skill.

## Open

### F-001 — "Why do I need a key if there's an MCP?" (P0, onboarding)
- Source: Shahdad, 2026-05-31, in chat, reacting to the shipped dashboard.
- Observed: a user with the MCP installed is told to "get an API key" and asks why a key is needed at all if the MCP exists.
- Expected (agent-native): install the MCP, say "send this PDF to alex@acme.com for signature," done. Never see or handle a key.
- Actual: the dashboard quickstart shows a key + "paste into env" + a curl snippet, and the MCP itself reads `SWIFTSIGN_API_KEY` from env to start. The human is doing the agent's job.
- Root cause: DocuSign-era auth model leaking in. The key is real (a legal sender + billing genuinely need an account), but it's surfaced to the human instead of provisioned invisibly by the agent.
- Fix: the MCP auto-provisions a sandbox account on first use and caches the credential in `~/.swiftsign/` — the human never touches a key. Live mode = the agent hands back a Stripe pay link (one click). Dashboard demotes the key to Settings → Advanced. Add an agent-readable onboarding (`llms.txt` + `/agents`).
- Severity: P0 — it is the core flow of an agent-native product, and the founder tripped on it.
- Dogfood evidence (2026-05-31, gstack browse of live https://swiftsign.ca/docs, screenshot /tmp/ss-docs.png): the page leads with "1 — Install the SDK" (`npm install swiftsign`) then "2 — Get a sandbox key." The MCP is not the hero anywhere. So an MCP user lands on an SDK-first, key-centric page. The agent-native language ("no account, no browser") is present but buried under the get-a-key framing. Fix the LEAD (MCP-first, key invisible), not just the copy.

### F-002 — No surface written for an agent to self-onboard (P1, docs)
- Source: Shahdad, 2026-05-31.
- Observed: `/docs` is written for a human developer (npm install, curl, "your key"). There is no surface an agent can be pointed at to bootstrap itself.
- Expected: a stable URL an LLM reads to self-onboard.
- Fix: serve `llms.txt` at `swiftsign.ca/llms.txt` + an `/agents` page in agent-imperative voice ("you are an agent; to send a document for signature, …").
- Severity: P1 — paired with F-001; the page is only true once the MCP plumbing (F-001) lands.

## Resolved

_(none yet)_
