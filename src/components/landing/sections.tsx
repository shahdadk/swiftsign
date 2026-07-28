import Link from "next/link";
import { InstallCard } from "./install-card";
import {
  Anchor,
  Api,
  ArrowRight,
  Check,
  Logo,
  Seal,
  Webhook,
} from "./icons";
import { SignupCta } from "./signup-cta";

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Install the MCP server",
      body: "One command. Works with Claude Code, Cursor, Zed, or anything MCP-aware.",
      code: "$ claude mcp add swiftsign -- npx -y swiftsign-mcp",
      lang: "bash",
    },
    {
      n: "02",
      title: "Describe what to sign",
      body: "Natural language. No field dragging, no form builder, no drag handles.",
      code: `> "Send mutual-nda.pdf to legal@acme.com, signature at the bottom."`,
      lang: "prompt",
    },
    {
      n: "03",
      title: "Get back a sealed PDF",
      body: "Recipients sign, you get a webhook + the sealed PDF and legal certificate of completion.",
      code: `POST /webhooks/envelope.completed
{ "status": "completed", "certificate": "...", "sha256": "d4…f2" }`,
      lang: "json",
    },
  ];
  return (
    <section className="how" id="how">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Three commands from&nbsp;nothing to&nbsp;sealed.</h2>
        </div>
        <div className="how-grid">
          {steps.map((s) => (
            <div key={s.n} className="how-card">
              <div className="how-card-n mono">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <pre className={"how-code mono lang-" + s.lang}>
                <code>{s.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DevGrid() {
  const cards = [
    {
      icon: <Api />,
      kicker: "REST",
      title: "REST API",
      code: `POST /api/v1/envelopes
Authorization: Bearer ss_live_…

{
  "document_url": "…",
  "recipients": [{ "email": "…" }],
  "anchor_tabs": [
    { "anchor": "_________", "type": "signature" }
  ]
}`,
    },
    {
      icon: <Anchor />,
      kicker: "Placement",
      title: "Anchor-based fields",
      code: `findAnchorPosition(
  "Party B — Signature",
  { offset: { x: 0, y: -4 } }
)
// → { page: 2, x: 112, y: 624 }`,
    },
    {
      icon: <Webhook />,
      kicker: "Events",
      title: "Webhooks + audit log",
      code: `envelope.sent
envelope.viewed
envelope.signed
envelope.completed
envelope.declined
envelope.voided`,
    },
    {
      icon: <Seal />,
      kicker: "Legal",
      title: "Sealed PDFs + certificate",
      code: `sha256: d4c1…f2a3
signed_at: 2026-03-14T17:04:11Z
ip: 50.18.44.201
location: CA / Ontario
compliance: ESIGN, UETA, Ontario ECA`,
    },
  ];
  return (
    <section className="devgrid" id="developers">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Built for developers</div>
          <h2>APIs where you&apos;d expect them.</h2>
        </div>
        <div className="devgrid-cards">
          {cards.map((c, i) => (
            <div key={i} className="dev-card">
              <div className="dev-card-head">
                <span className="dev-card-icon">{c.icon}</span>
                <span className="dev-card-kicker mono">{c.kicker}</span>
              </div>
              <h3>{c.title}</h3>
              <pre className="dev-card-code mono">
                <code>{c.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const plans = [
    {
      id: "sandbox",
      name: "Sandbox",
      price: "Free",
      period: "forever",
      blurb: "For building and testing agent flows.",
      features: [
        "Unlimited test envelopes",
        "Instant sk_test_ key, no account",
        "Watermarked, non-binding sends",
        "MCP server + REST API",
        "Webhook subscriptions",
      ],
      cta: "Get a sandbox key",
      ctaClass: "btn-ghost",
      featured: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$15",
      period: "/mo · per workspace, flat",
      blurb: "For production sends, per workspace.",
      features: [
        "Live sends, no watermark",
        "Sealed PDFs + Certificate of Completion",
        "Webhook subscriptions",
        "Templates + embedded signing",
        "Fair use: 100 envelopes a month",
      ],
      cta: "Upgrade from your terminal",
      ctaClass: "btn-accent",
      featured: true,
    },
  ];

  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Pricing</div>
          <h2>One flat price.</h2>
          <p className="section-sub">
            Sandbox is free forever. Pro is $15 a month per workspace, flat.
            Your agent can initiate the upgrade from the terminal.
          </p>
        </div>

        <div className="pricing-grid pricing-grid-2">
          {plans.map((p) => (
            <div key={p.id} className={"price-card " + (p.featured ? "featured" : "")}>
              {p.featured && <div className="price-badge mono">live</div>}
              <div className="price-name mono">{p.name}</div>
              <div className="price-amount">
                <span className="price-num">{p.price}</span>
                <span className="price-period mono">{p.period}</span>
              </div>
              <p className="price-blurb">{p.blurb}</p>
              <ul className="price-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <span className="price-check">
                      <Check size={12} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#cta" className={"btn " + p.ctaClass + " price-cta"}>
                {p.cta} <ArrowRight />
              </a>
            </div>
          ))}
        </div>

        <div className="pricing-footnote mono">
          <span>
            For reference: DocuSign Standard <b>$45/mo</b> · Adobe Acrobat Sign{" "}
            <b>$29.99/mo</b> · per user · as of June 2026
          </span>
          <span>
            Pro fair use: past <b>100 envelopes/mo</b>, talk to us
          </span>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/pricing" className="link-arrow">
            See full pricing <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="finalcta" id="cta">
      <div className="finalcta-glow" />
      <div className="container finalcta-inner">
        <div className="eyebrow">Start shipping</div>
        <h2 className="finalcta-title">
          Your first envelope
          <br />
          is one <span className="finalcta-accent">npx</span> away.
        </h2>
        <div className="finalcta-install">
          <InstallCard />
        </div>
        <div className="finalcta-actions">
          <SignupCta />
          <Link href="/docs" className="btn btn-ghost">
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link href="/" className="nav-logo">
            <Logo />
            <span className="mono">swiftsign</span>
          </Link>
          <p className="footer-tag">
            AI-native signatures.
            <br />
            Send, track, and seal from your terminal.
          </p>
          <div className="footer-compliance mono">
            <span>ESIGN</span>
            <span className="sep">·</span>
            <span>UETA</span>
            <span className="sep">·</span>
            <span>Ontario ECA</span>
            <span className="sep">·</span>
            <span>SHA-256 sealed</span>
          </div>
        </div>
        <div className="footer-cols">
          <div>
            <h4 className="mono">Product</h4>
            <Link href="/#demo">Terminal demo</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/trust">Trust &amp; security</Link>
          </div>
          <div>
            <h4 className="mono">Developers</h4>
            <Link href="/docs">Documentation</Link>
            <Link href="/reference">API explorer</Link>
            <Link href="/guides/e-signature-api-for-ai-coding-tools">Integration guide</Link>
            <a href="https://github.com/shahdadk/swiftsign" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
          <div>
            <h4 className="mono">Legal</h4>
            <Link href="/legal/terms">Terms of Service</Link>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <Link href="/legal/dpa">Data Processing Addendum</Link>
            <Link href="/legal/acceptable-use">Acceptable Use</Link>
            <Link href="/legal/subprocessors">Subprocessors</Link>
            <a href="mailto:support@swiftsign.ca">Contact</a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom mono">
        <span>© 2026 SwiftSign</span>
        <span>Ontario, Canada</span>
      </div>
    </footer>
  );
}
