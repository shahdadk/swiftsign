import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { Footer } from "@/components/landing/sections";
import { SignupCta } from "@/components/landing/signup-cta";

export const metadata: Metadata = {
  title: "Add e-signatures from Claude Code, Cursor, or any MCP client · SwiftSign",
  description:
    "A step-by-step guide to adding e-signatures to your app from an AI coding tool: install the SwiftSign MCP server, mint a sandbox key, send a PDF, check status, and download the sealed result.",
};

const steps = [
  { name: "Install the SwiftSign MCP server" },
  { name: "Mint a sandbox API key" },
  { name: "Send a document for signature" },
  { name: "Check status and download the sealed PDF" },
  { name: "Go live" },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Add e-signatures from an AI coding tool with SwiftSign",
  step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name })),
};

function Code({ children }: { children: string }) {
  return (
    <pre className="install-code mono" style={{ marginBottom: 24, whiteSpace: "pre-wrap" }}>
      <code>{children}</code>
    </pre>
  );
}

export default function GuidePage() {
  return (
    <>
      <NavBar />
      <main className="container" style={{ maxWidth: 820, padding: "96px 24px 48px" }}>
        <div className="eyebrow">Guide</div>
        <h1 className="hero-h1" style={{ fontSize: 36, marginBottom: 16 }}>
          Add e-signatures from Claude Code, Cursor, or any MCP client.
        </h1>
        <p className="hero-sub" style={{ marginBottom: 36 }}>
          The whole loop, from a key to a sealed PDF, runs through one MCP server. Start in the sandbox for
          free with no account, then flip to live when you are ready.
        </p>

        <h2 style={{ fontSize: 20, margin: "8px 0 12px" }}>1. Install the MCP server</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>Claude Code:</p>
        <Code>claude mcp add swiftsign -- npx -y swiftsign-mcp</Code>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>Cursor (~/.cursor/mcp.json):</p>
        <Code>{`{
  "mcpServers": {
    "swiftsign": { "command": "npx", "args": ["-y", "swiftsign-mcp"] }
  }
}`}</Code>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>Or the hosted endpoint, no local install:</p>
        <Code>{`claude mcp add --transport http swiftsign https://swiftsign.ca/mcp \\
  --header "Authorization: Bearer sk_test_your_key"`}</Code>

        <h2 style={{ fontSize: 20, margin: "8px 0 12px" }}>2. Mint a sandbox key</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>
          Ask the agent to run the <code>swiftsign_signup</code> tool, or curl it directly. No account, no browser.
        </p>
        <Code>{`curl -s -X POST https://swiftsign.ca/api/v1/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com"}'
# -> { "api_key": "sk_test_...", "mode": "test", ... }`}</Code>

        <h2 style={{ fontSize: 20, margin: "8px 0 12px" }}>3. Send a document</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>
          Call <code>swiftsign_send_envelope</code> with a base64 PDF, recipients, and field placement. Place
          a field by page coordinates or by an anchor string in the document, not both.
        </p>
        <Code>{`{
  "subject": "Mutual NDA",
  "documents": [{ "name": "nda.pdf", "base64": "JVBERi0xLjcK..." }],
  "recipients": [
    { "name": "Dana Lee", "email": "dana@acme.com", "role": "SIGNER", "routingOrder": 1 }
  ],
  "fields": [
    { "recipientIndex": 0, "type": "SIGNATURE", "document": 0,
      "page": -1, "x": 0, "y": 0, "anchor": "Party B Signature" }
  ]
}`}</Code>
        <p className="mono" style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 24 }}>
          Sandbox keys send immediately and watermarked. Live keys create a draft and return it for human
          review unless you pass confirm: true.
        </p>

        <h2 style={{ fontSize: 20, margin: "8px 0 12px" }}>4. Check status and download</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>
          Use <code>swiftsign_check_status</code> to watch the envelope, then <code>swiftsign_download_signed_pdf</code> once
          it is COMPLETED to pull back the sealed document and its Certificate of Completion.
        </p>
        <Code>{`# status: SENT -> COMPLETED
swiftsign_check_status { "envelopeId": "env_..." }
swiftsign_download_signed_pdf { "envelopeId": "env_...", "certificate": false }`}</Code>

        <h2 style={{ fontSize: 20, margin: "8px 0 12px" }}>5. Go live</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 12 }}>
          Run <code>swiftsign_upgrade</code> to get a Stripe checkout link. A human opens it once to add a
          card; your agent can initiate the upgrade but cannot complete the payment itself. Live sends are
          confirm-gated, so an agent drafts and a person approves before anything is emailed.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "36px 0 48px" }}>
          <SignupCta />
          <Link href="/docs" className="btn btn-ghost">Full API reference</Link>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
    </>
  );
}
