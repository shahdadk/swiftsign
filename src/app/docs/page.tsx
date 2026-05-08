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
          <h5>Getting started</h5>
          <a href="#quickstart">Quickstart</a>
          <a href="#install">Install the MCP</a>
          <a href="#first-envelope">First envelope</a>

          <h5>MCP reference</h5>
          <a href="#mcp-tools">Tools</a>
          <a href="#mcp-send">swiftsign_send_envelope</a>
          <a href="#mcp-status">swiftsign_status</a>
          <a href="#mcp-cancel">swiftsign_cancel</a>

          <h5>REST API</h5>
          <a href="#api">Overview</a>
          <a href="#api-auth">Authentication</a>
          <a href="#api-envelopes">Envelopes</a>
          <a href="#webhooks">Webhooks</a>

          <h5>Compliance</h5>
          <a href="#compliance">ESIGN · UETA · PIPEDA</a>
        </aside>

        <main className="docs-main">
          <div className="eyebrow">Getting started</div>
          <h1 id="quickstart">SwiftSign in 60 seconds.</h1>
          <p className="docs-lede">
            SwiftSign ships as an MCP server and a REST API. Install the MCP once, then describe
            what to sign in plain English — Claude, Cursor, or any MCP-aware agent will handle the
            rest.
          </p>

          <h2 id="install">Install the MCP server</h2>
          <p>From any terminal with Node 18+ and Claude Code:</p>
          <pre>
            <code>claude mcp add swiftsign -- npx -y swiftsign-mcp</code>
          </pre>

          <p>
            Or add it to <code>.mcp.json</code> directly:
          </p>
          <pre>
            <code>{`{
  "mcpServers": {
    "swiftsign": {
      "command": "npx",
      "args": ["-y", "swiftsign-mcp"],
      "env": { "SWIFTSIGN_API_KEY": "ss_live_…" }
    }
  }
}`}</code>
          </pre>

          <h2 id="first-envelope">Send your first envelope</h2>
          <p>Once the MCP is connected, prompt the agent naturally:</p>
          <pre className="light">
            <code>
              {`> send the NDA at ~/contracts/mutual-nda.pdf to steve@acme.com for signature`}
            </code>
          </pre>
          <p>
            SwiftSign reads the PDF, finds signature anchors, builds the envelope, and sends it.
            You&apos;ll get a webhook back when Steve signs.
          </p>

          <h2 id="mcp-tools">MCP tools</h2>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>swiftsign_send_envelope</code>
                </td>
                <td>Send a document for signature</td>
              </tr>
              <tr>
                <td>
                  <code>swiftsign_status</code>
                </td>
                <td>Check status of any envelope</td>
              </tr>
              <tr>
                <td>
                  <code>swiftsign_cancel</code>
                </td>
                <td>Void an in-flight envelope</td>
              </tr>
              <tr>
                <td>
                  <code>swiftsign_list</code>
                </td>
                <td>List recent envelopes, filtered</td>
              </tr>
              <tr>
                <td>
                  <code>swiftsign_download</code>
                </td>
                <td>Fetch sealed PDF + certificate</td>
              </tr>
            </tbody>
          </table>

          <h3 id="mcp-send">
            <span className="docs-chip">tool</span>swiftsign_send_envelope
          </h3>
          <p>Primary tool. Accepts either explicit coordinates or anchor-based placement.</p>
          <pre>
            <code>{`{
  "document": "~/contracts/mutual-nda.pdf",
  "recipients": [
    { "email": "steve@acme.com", "name": "Steve Park", "role": "signer" }
  ],
  "fields": [
    { "type": "signature", "anchor": "Party B — Signature", "offset": { "y": -4 } },
    { "type": "date",      "anchor": "Date:",               "near": "prev"    }
  ],
  "subject": "Mutual NDA for countersignature",
  "expires_in_days": 14
}`}</code>
          </pre>

          <h2 id="api">REST API</h2>
          <p>
            All MCP tools are thin wrappers around the REST API. If you want to integrate from a
            non-agent environment — a cron job, a CI workflow, your own backend — hit the API
            directly.
          </p>

          <h3 id="api-auth">Authentication</h3>
          <p>
            Bearer token in the <code>Authorization</code> header. Get yours from the dashboard.
          </p>
          <pre>
            <code>{`curl https://api.swiftsign.dev/v1/envelopes \\
  -H "Authorization: Bearer ss_live_abc123..."`}</code>
          </pre>

          <h3 id="api-envelopes">Create an envelope</h3>
          <pre>
            <code>{`POST /v1/envelopes
Authorization: Bearer ss_live_…
Content-Type: application/json

{
  "document_url": "https://…/mutual-nda.pdf",
  "recipients": [{ "email": "steve@acme.com" }],
  "anchor_tabs": [
    { "anchor": "_________", "type": "signature" }
  ]
}`}</code>
          </pre>

          <h3>Response</h3>
          <pre>
            <code>{`{
  "id": "env_3f8a9c21",
  "status": "sent",
  "recipients": [{ "email": "steve@acme.com", "status": "pending" }],
  "created_at": "2026-03-14T16:02:11Z",
  "expires_at": "2026-03-28T16:02:11Z"
}`}</code>
          </pre>

          <h3 id="webhooks">Webhooks</h3>
          <p>Register a URL once; receive signed events for the lifetime of every envelope.</p>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>envelope.sent</code>
                </td>
                <td>Delivered to recipient&apos;s inbox</td>
              </tr>
              <tr>
                <td>
                  <code>envelope.viewed</code>
                </td>
                <td>Recipient opened the document</td>
              </tr>
              <tr>
                <td>
                  <code>envelope.signed</code>
                </td>
                <td>Recipient applied their signature</td>
              </tr>
              <tr>
                <td>
                  <code>envelope.completed</code>
                </td>
                <td>All recipients signed; sealed PDF ready</td>
              </tr>
              <tr>
                <td>
                  <code>envelope.declined</code>
                </td>
                <td>Recipient declined</td>
              </tr>
              <tr>
                <td>
                  <code>envelope.expired</code>
                </td>
                <td>Not signed before expiry</td>
              </tr>
            </tbody>
          </table>

          <h2 id="compliance">Compliance</h2>
          <p>
            SwiftSign-sealed PDFs are compliant with the US <b>ESIGN Act</b> (2000) and{" "}
            <b>UETA</b>, and with Canada&apos;s <b>PIPEDA</b>. Each completed envelope produces
            a Certificate of Completion that records, per signer:
          </p>
          <ul>
            <li>SHA-256 of the original and sealed document</li>
            <li>UTC timestamp recorded in the audit trail</li>
            <li>
              IP address, user agent, and approximate location (country / city
              from request headers) of the signing session
            </li>
            <li>Signer name, email, and explicit ESIGN/UETA consent capture</li>
          </ul>
          <p>
            SwiftSign does not currently provide RFC 3161 cryptographic
            timestamps, qualified eIDAS signatures, HIPAA BAAs, or a SOC 2
            report — those are on the roadmap. If your use case requires them,
            email{" "}
            <a href="mailto:hello@swiftsign.ca">hello@swiftsign.ca</a>.
          </p>

          <div className="docs-cta">
            <p>SwiftSign is in private beta — request access to get an API key.</p>
            <a
              href="mailto:hello@swiftsign.ca?subject=SwiftSign%20beta%20access"
              className="btn btn-primary"
            >
              Request access <ArrowRight />
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
