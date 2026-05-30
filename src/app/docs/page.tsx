import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { ArrowRight } from "@/components/landing/icons";

export const metadata = {
  title: "SwiftSign — Docs",
};

export default function DocsPage() {
  return (
    <>
      <NavBar />
      <div className="docs-layout">
        <aside className="docs-nav">
          <h5>Quickstart</h5>
          <a href="#quickstart">Send in 5 minutes</a>
          <a href="#install">1 · Install</a>
          <a href="#signup">2 · Get a key</a>
          <a href="#send">3 · Send (sandbox)</a>
          <a href="#golive">4 · Go live</a>
          <a href="#curl">curl equivalent</a>

          <h5>Reference</h5>
          <a href="#auth">Authentication</a>
          <a href="#fields">Field types</a>
          <a href="#idempotency">Idempotency</a>
          <a href="#pagination">Pagination</a>
          <a href="#errors">Error codes</a>
          <a href="/reference">API explorer</a>
        </aside>

        <main className="docs-main">
          <div className="eyebrow">Quickstart</div>
          <h1 id="quickstart">Send your first sealed envelope in 5 minutes.</h1>
          <p className="docs-lede">
            SwiftSign is built to be driven by agents and code, not a dashboard. One
            unauthenticated call gives you a sandbox key, so an agent or a terminal is
            productive immediately. The fastest path is the npm SDK below — there is a{" "}
            <a href="#curl">plain curl version</a> right after it.
          </p>

          <h2 id="install">1 · Install the SDK</h2>
          <p>From any project with Node 18+:</p>
          <pre>
            <code>npm install swiftsign</code>
          </pre>

          <h2 id="signup">2 · Get a sandbox key</h2>
          <p>
            No account, no browser. <code>POST /api/v1/signup</code> is the only
            unauthenticated endpoint — it provisions an account and returns a{" "}
            <code>sk_test_</code> key on the spot.
          </p>
          <pre>
            <code>{`import SwiftSign from "swiftsign";

// One call, no auth — returns a sandbox key.
const { api_key } = await SwiftSign.signup({ email: "dev@acme.com" });

const ss = new SwiftSign({ apiKey: api_key }); // sk_test_…`}</code>
          </pre>

          <h2 id="send">3 · Send a sandbox envelope</h2>
          <p>
            Sandbox sends are free and watermarked. Pass the PDF as base64, drop a
            signature field where you want it, then send.
          </p>
          <pre>
            <code>{`import { readFileSync } from "node:fs";

const env = await ss.envelopes.create({
  subject: "Mutual NDA for countersignature",
  documents: [
    { name: "nda.pdf", base64: readFileSync("nda.pdf").toString("base64") },
  ],
  recipients: [{ name: "Steve Park", email: "steve@acme.com" }],
  fields: [
    { recipientIndex: 0, document: 0, type: "SIGNATURE", anchor: "Party B — Signature" },
  ],
});

// Envelope is created as DRAFT — send it.
await ss.envelopes.send(env.id); // → { status: "sent" }`}</code>
          </pre>
          <p>
            Steve gets an email with a signing link. When he signs, SwiftSign seals the
            PDF and produces a Certificate of Completion.
          </p>

          <h2 id="golive">4 · Go live</h2>
          <p>
            Sandbox is free forever. To send real, un-watermarked envelopes, verify your
            email and add a card. <code>POST /api/v1/billing/upgrade</code> returns a Stripe
            Checkout URL.
          </p>
          <pre>
            <code>{`const { checkout_url } = await ss.billing.upgrade({ plan: "PRO" });
// Open checkout_url, pay, then mint a sk_live_ key from the dashboard.`}</code>
          </pre>

          <h2 id="curl">The same flow in curl</h2>
          <p>No SDK required — every SDK method is a thin wrapper over the REST API.</p>
          <pre>
            <code>{`# 1. Get a sandbox key (no auth)
curl -s https://swiftsign.ca/api/v1/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"dev@acme.com"}'
# → { "api_key": "sk_test_…", "mode": "test", ... }

# 2. Create an envelope (base64 the PDF first)
curl -s https://swiftsign.ca/api/v1/envelopes \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Mutual NDA",
    "documents": [{ "name": "nda.pdf", "base64": "JVBERi0…" }],
    "recipients": [{ "name": "Steve Park", "email": "steve@acme.com" }],
    "fields": [{ "recipientIndex": 0, "document": 0, "type": "SIGNATURE", "anchor": "Party B — Signature" }]
  }'
# → { "id": "…", "status": "DRAFT", ... }

# 3. Send it
curl -s https://swiftsign.ca/api/v1/envelopes/ENV_ID \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"send"}'`}</code>
          </pre>

          <h2 id="auth">Authentication</h2>
          <p>
            Every endpoint except <code>POST /api/v1/signup</code> requires a Bearer API
            key in the <code>Authorization</code> header.
          </p>
          <pre>
            <code>{`Authorization: Bearer sk_live_abc123…`}</code>
          </pre>
          <p>Two key modes, distinguished by prefix:</p>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Mode</th>
                <th>Behaviour</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>sk_test_</code>
                </td>
                <td>Sandbox</td>
                <td>Free, watermarked sends. No quota.</td>
              </tr>
              <tr>
                <td>
                  <code>sk_live_</code>
                </td>
                <td>Live</td>
                <td>Real, sealed sends. Counts against your plan quota.</td>
              </tr>
            </tbody>
          </table>

          <h2 id="fields">Field types</h2>
          <p>
            Each field is placed by explicit <code>x</code>/<code>y</code> percentages
            (0–100, top-left origin) or by an <code>anchor</code> string SwiftSign finds in
            the PDF text.
          </p>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>What the signer does</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>SIGNATURE</code>
                </td>
                <td>Draws or adopts a signature</td>
              </tr>
              <tr>
                <td>
                  <code>INITIALS</code>
                </td>
                <td>Applies their initials</td>
              </tr>
              <tr>
                <td>
                  <code>NAME</code>
                </td>
                <td>Full name (auto-filled)</td>
              </tr>
              <tr>
                <td>
                  <code>DATE</code>
                </td>
                <td>Signing date (auto-filled)</td>
              </tr>
              <tr>
                <td>
                  <code>TEXT</code>
                </td>
                <td>Free-text input</td>
              </tr>
              <tr>
                <td>
                  <code>CHECKBOX</code>
                </td>
                <td>A single checkable box</td>
              </tr>
              <tr>
                <td>
                  <code>RADIO</code>
                </td>
                <td>One choice from <code>options[]</code></td>
              </tr>
              <tr>
                <td>
                  <code>DROPDOWN</code>
                </td>
                <td>One choice from <code>options[]</code></td>
              </tr>
              <tr>
                <td>
                  <code>ATTACHMENT</code>
                </td>
                <td>Uploads a supporting file</td>
              </tr>
            </tbody>
          </table>

          <h2 id="idempotency">Idempotency</h2>
          <p>
            Send an <code>Idempotency-Key</code> header on{" "}
            <code>POST /api/v1/envelopes</code> to make creates safe to retry. A repeated
            request with the same key and the same body replays the original response
            instead of creating a second envelope. Reusing a key with a{" "}
            <em>different</em> body returns <code>422 idempotency_key_reused</code>.
          </p>
          <pre>
            <code>{`Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef0123456789`}</code>
          </pre>

          <h2 id="pagination">Pagination</h2>
          <p>
            List endpoints (<code>GET /api/v1/envelopes</code>,{" "}
            <code>GET /api/v1/templates</code>) use opaque cursor pagination. Pass{" "}
            <code>limit</code> (default 25, max 100); follow <code>next_cursor</code> until{" "}
            <code>has_more</code> is <code>false</code>.
          </p>
          <pre>
            <code>{`{
  "data": [ /* … */ ],
  "has_more": true,
  "next_cursor": "eyJjIjoiMjAyNi0wMy0xNFQ…"
}

// next page:
GET /api/v1/envelopes?cursor=eyJjIjoiMjAyNi0wMy0xNFQ…&limit=25`}</code>
          </pre>

          <h2 id="errors">Error codes</h2>
          <p>
            Errors are RFC 9457 problem documents served as{" "}
            <code>application/problem+json</code>. Branch on the machine-readable{" "}
            <code>code</code>, not on <code>title</code>. Every error carries a{" "}
            <code>request_id</code> for support.
          </p>
          <pre>
            <code>{`{
  "type": "https://swiftsign.ca/errors/validation_error",
  "title": "Request validation failed",
  "status": 400,
  "code": "validation_error",
  "detail": "A valid email is required",
  "request_id": "req_8c2f9a1b3d4e5f6071829304"
}`}</code>
          </pre>
          <table className="docs-table">
            <thead>
              <tr>
                <th>HTTP</th>
                <th>code</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>400</td>
                <td><code>validation_error</code></td>
                <td>Body or query failed validation.</td>
              </tr>
              <tr>
                <td>401</td>
                <td><code>unauthorized</code></td>
                <td>Missing or invalid API key.</td>
              </tr>
              <tr>
                <td>402</td>
                <td><code>envelope_quota_exceeded</code></td>
                <td>Monthly live-envelope quota reached.</td>
              </tr>
              <tr>
                <td>403</td>
                <td><code>forbidden</code></td>
                <td>Key lacks the required scope.</td>
              </tr>
              <tr>
                <td>404</td>
                <td><code>envelope_not_found</code></td>
                <td>No envelope with that id for this account.</td>
              </tr>
              <tr>
                <td>404</td>
                <td><code>template_not_found</code></td>
                <td>No template with that id for this account.</td>
              </tr>
              <tr>
                <td>409</td>
                <td><code>invalid_state</code></td>
                <td>Resource not in a valid state for the action.</td>
              </tr>
              <tr>
                <td>409</td>
                <td><code>idempotency_conflict</code></td>
                <td>A request with this key is still processing.</td>
              </tr>
              <tr>
                <td>413</td>
                <td><code>payload_too_large</code></td>
                <td>Request body exceeds the 50 MB limit.</td>
              </tr>
              <tr>
                <td>422</td>
                <td><code>anchor_unresolved</code></td>
                <td>A field anchor was not found in the document.</td>
              </tr>
              <tr>
                <td>422</td>
                <td><code>idempotency_key_reused</code></td>
                <td>Key reused with a different request body.</td>
              </tr>
              <tr>
                <td>429</td>
                <td><code>rate_limited</code></td>
                <td>Too many requests; back off and retry.</td>
              </tr>
              <tr>
                <td>503</td>
                <td><code>billing_unavailable</code></td>
                <td>Billing is temporarily unavailable.</td>
              </tr>
              <tr>
                <td>500</td>
                <td><code>internal_error</code></td>
                <td>Something broke on our side.</td>
              </tr>
            </tbody>
          </table>

          <div className="docs-cta">
            <p>
              Every endpoint, request body, and response is documented in the interactive
              API explorer — try calls right in the browser.
            </p>
            <Link href="/reference" className="btn btn-primary">
              Open the API explorer <ArrowRight />
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
