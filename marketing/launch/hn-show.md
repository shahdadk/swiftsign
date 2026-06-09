# Show HN draft (publish AFTER the trusted cert lands — war-plan gate)

**Title:** Show HN: SwiftSign – an e-signature API your coding agent can set up itself

**Body:**

I built an e-signature service where the entire loop happens inside an MCP client
(Claude Code, Cursor, etc.): the agent mints its own sandbox key with one tool call
(no account, no browser), sends a PDF with anchor-placed fields, tracks status,
and downloads the sealed result.

The part I'm most proud of is the safety model, because "you let an agent send
contracts?!" is the right first question. Live-mode sends are draft-by-default:
the agent gets back a dashboard link and a confirmation step a human has to
approve (or it can pass confirm:true if you've built approval upstream).
Sandbox sends are watermarked and unlimited. New accounts get hard velocity
caps so the instant-key flow can't become phishing infrastructure.

Under the hood: RFC 9457 errors everywhere (agents actually self-correct off
the error codes), Idempotency-Key on create, cursor pagination, PKCS#7/PAdES
sealing with RFC-3161 timestamps and a hash-chained audit trail, webhooks with
HMAC signing and retries. Stack is Next 16 + Postgres + R2.

Install: `claude mcp add swiftsign -- npx -y swiftsign-mcp`
or hosted: `https://swiftsign.ca/mcp` (OAuth or Bearer).

Pricing is $15/mo flat (fair-use 100 envelopes), sandbox free forever.

DocuSign shipped an MCP server too, and honestly it's fine — but it assumes you
already have a DocuSign account and a human to OAuth into it. The bet here is
that the next wave of signing volume starts inside the agent, where account
creation, payment initiation, and the paperwork itself are all part of one loop.

Happy to answer anything about the sealing pipeline, the MCP design, or the
abuse-prevention tradeoffs.

---
*Checklist before posting: cert landed + Adobe shows trusted; demo link in first
comment; pricing page live; status of "legally binding" claims reviewed against
/trust wording. Post from Shahdad's account, morning ET weekday.*
