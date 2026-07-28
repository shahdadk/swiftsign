import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { Footer } from "@/components/landing/sections";
import { Check } from "@/components/landing/icons";
import { SignupCta } from "@/components/landing/signup-cta";

export const metadata: Metadata = {
  title: "DocuSign alternative for developers and AI coding tools · SwiftSign",
  description:
    "SwiftSign is an e-signature API and MCP server built for developers and AI coding tools: a sandbox key, $15/mo flat, and the whole signing loop inside your agent. An honest comparison with DocuSign.",
};

const faqs = [
  {
    q: "Are SwiftSign signatures legally binding?",
    a: "SwiftSign is designed to support electronic-signature workflows under the U.S. ESIGN Act and UETA and Canadian electronic-commerce legislation. Each completed document is hashed with SHA-256 and ships with a Certificate of Completion that records the signer name, email, IP, timestamp, and signature method, backed by a hash-chained, tamper-evident audit trail. Whether a signature is valid depends on the document, consent flow, parties, and applicable law. Cryptographic in-PDF signing with a publicly trusted certificate is available for live workspaces that need it. Sandbox sends are watermarked and explicitly non-binding.",
  },
  {
    q: "Can my AI agent actually send contracts?",
    a: "Yes, with a human in the loop by default. On a live key the send tool creates a draft and returns it for review; a person approves it (or your own upstream approval passes confirm: true) before any email goes out. Sandbox sends are immediate and watermarked. New accounts also have send-velocity and recipient caps.",
  },
  {
    q: "How much does it cost?",
    a: "Sandbox is free forever with unlimited test envelopes. Pro is $15 a month per workspace, flat, with a fair-use allowance of 100 envelopes a month. No per-seat pricing and no per-envelope metering.",
  },
  {
    q: "How do I migrate my DocuSign templates?",
    a: "There is an open-source command, npx swiftsign-mcp import-docusign, that you run yourself against your own DocuSign developer credentials. It reads your templates (documents, roles, fields) and recreates them as SwiftSign templates, reporting anything that does not map cleanly. Your data is never proxied through SwiftSign servers.",
  },
  {
    q: "Is there a sandbox?",
    a: "Yes. POST /api/v1/signup returns an sk_test_ key with just an email, no account and no browser. Test sends are watermarked, non-binding, and unlimited.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const compare: Array<{ feature: string; swiftsign: string; docusign: string }> = [
  { feature: "Get started", swiftsign: "Sandbox key, no account", docusign: "Account required; API plans via sales" },
  { feature: "MCP server", swiftsign: "First-party, stdio + hosted URL", docusign: "Yes (requires a DocuSign account)" },
  { feature: "Agent sends", swiftsign: "Confirm-gated draft on live keys", docusign: "Standard API send" },
  { feature: "Pricing", swiftsign: "$15/mo flat, fair-use 100/mo", docusign: "From $45/user/mo (Standard, list)" },
  { feature: "Sealed PDF + Certificate", swiftsign: "Yes, SHA-256 + audit trail", docusign: "Yes" },
  { feature: "Compliance breadth", swiftsign: "ESIGN / UETA / Canadian e-sign workflows", docusign: "Broad enterprise certifications" },
];

export default function DocuSignAlternativePage() {
  return (
    <>
      <NavBar />
      <main className="container" style={{ maxWidth: 860, padding: "96px 24px 48px" }}>
        <div className="eyebrow">DocuSign alternative</div>
        <h1 className="hero-h1" style={{ fontSize: 40, marginBottom: 16 }}>
          The DocuSign alternative built for developers and AI coding tools.
        </h1>
        <p className="hero-sub" style={{ marginBottom: 8 }}>
          SwiftSign is an e-signature API and MCP server you can wire into Claude Code, Cursor, or any
          backend in minutes: a sandbox key, $15 a month flat, and the whole
          signing loop, from key to sealed PDF, runnable inside your agent.
        </p>
        <p className="mono" style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 32 }}>
          DocuSign&apos;s MCP server needs a DocuSign account. SwiftSign needs one prompt.
        </p>

        <h2 style={{ fontSize: 22, margin: "8px 0 12px" }}>Who this is for</h2>
        <ul className="price-features" style={{ marginBottom: 36 }}>
          <li><span className="price-check"><Check size={12} /></span> Indie developers who want a key and a curl, not a procurement cycle</li>
          <li><span className="price-check"><Check size={12} /></span> AI-native teams embedding signing into agent workflows</li>
          <li><span className="price-check"><Check size={12} /></span> Anyone sending a handful of contracts a month who does not want per-seat pricing</li>
        </ul>

        <h2 style={{ fontSize: 22, margin: "8px 0 12px" }}>SwiftSign vs DocuSign</h2>
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line-2)" }}>
                <th align="left" style={{ padding: "8px 12px 8px 0" }}>Feature</th>
                <th align="left" style={{ padding: "8px 12px" }}>SwiftSign</th>
                <th align="left" style={{ padding: "8px 12px" }}>DocuSign</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((r) => (
                <tr key={r.feature} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 12px 8px 0", color: "var(--ink-4)" }}>{r.feature}</td>
                  <td style={{ padding: "8px 12px" }}>{r.swiftsign}</td>
                  <td style={{ padding: "8px 12px" }}>{r.docusign}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mono" style={{ fontSize: 11, color: "var(--ink-5)", marginBottom: 36 }}>
          DocuSign list prices and product facts as of June 2026, from DocuSign&apos;s public pricing and
          developer documentation. Not a benchmark of either system.
        </p>

        <h2 style={{ fontSize: 22, margin: "8px 0 12px" }}>When DocuSign is the right call</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 36, lineHeight: 1.6 }}>
          We would rather you pick the right tool. DocuSign is the stronger choice if you are a regulated
          enterprise that needs its breadth of compliance certifications, if you need qualified or advanced
          electronic signatures under eIDAS, or if your procurement process requires an established,
          publicly-traded vendor. SwiftSign is the better fit when time-to-first-signature, a flat price,
          and an agent-native API matter more than that breadth.
        </p>

        <h2 style={{ fontSize: 22, margin: "8px 0 12px" }}>Install</h2>
        <pre className="install-code mono" style={{ marginBottom: 12 }}>
          <code>claude mcp add swiftsign -- npx -y swiftsign-mcp</code>
        </pre>
        <pre className="install-code mono" style={{ marginBottom: 28 }}>
          <code>{`# or the hosted endpoint, no install:\nhttps://swiftsign.ca/mcp`}</code>
        </pre>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 48 }}>
          <SignupCta />
          <Link href="/guides/e-signature-api-for-ai-coding-tools" className="btn btn-ghost">
            Read the integration guide
          </Link>
        </div>

        <h2 style={{ fontSize: 22, margin: "8px 0 16px" }}>Frequently asked questions</h2>
        {faqs.map((f) => (
          <div key={f.q} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>{f.q}</h3>
            <p style={{ color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}

        <p className="mono" style={{ fontSize: 11, color: "var(--ink-5)", marginTop: 40, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          DocuSign and Adobe are trademarks of their respective owners. SwiftSign is not affiliated with or
          endorsed by them. Comparisons use publicly available information as of June 2026.
        </p>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
