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
compliance: ESIGN, UETA, PIPEDA`,
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
      id: "beta",
      name: "Beta",
      price: "Free",
      period: "while it lasts",
      blurb: "Unlimited during the open beta.",
      features: [
        "Unlimited envelopes",
        "MCP server + REST API",
        "Webhook subscriptions",
        "Routing-order signing",
        "ESIGN/UETA/PIPEDA sealed PDFs",
      ],
      cta: "Get API key",
      ctaClass: "btn-accent",
      featured: true,
    },
    {
      id: "soon",
      name: "Pro",
      price: "$15",
      period: "per month — soon",
      blurb: "Paid plans land later this year.",
      features: [
        "Everything from beta",
        "Priority support",
        "Custom branding",
        "Higher rate limits",
        "Stripe Tax + invoices",
      ],
      cta: "Notify me",
      ctaClass: "btn-ghost",
      featured: false,
    },
  ];

  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Pricing</div>
          <h2>Free during beta.</h2>
          <p className="section-sub">
            We&apos;re shipping. Use it now, free, and we&apos;ll tell you before any
            charges land. Cancel from the CLI when paid plans go live.
          </p>
        </div>

        <div className="pricing-grid pricing-grid-2">
          {plans.map((p) => (
            <div key={p.id} className={"price-card " + (p.featured ? "featured" : "")}>
              {p.featured && <div className="price-badge mono">use this now</div>}
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
            <b>$29.99/mo</b> · per user
          </span>
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
          <Link href="/dashboard" className="btn btn-primary">
            Get your API key <ArrowRight />
          </Link>
          <Link href="/docs" className="btn btn-ghost">
            Read the docs
          </Link>
        </div>
        <div className="finalcta-meta mono">
          <span>no credit card</span>
          <span className="sep">·</span>
          <span>unlimited during beta</span>
          <span className="sep">·</span>
          <span>cancel from the CLI</span>
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
            <span>PIPEDA</span>
            <span className="sep">·</span>
            <span>SHA-256 sealed</span>
          </div>
        </div>
        <div className="footer-cols">
          <div>
            <h4 className="mono">Product</h4>
            <a href="#demo">Terminal demo</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link href="/docs">Docs</Link>
          </div>
          <div>
            <h4 className="mono">Developers</h4>
            <Link href="/docs">MCP server</Link>
            <Link href="/docs#api">REST API</Link>
            <Link href="/docs#webhooks">Webhooks</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
          <div>
            <h4 className="mono">Company</h4>
            <a href="#">Blog</a>
            <a href="#">Legal</a>
            <a href="#">Privacy</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom mono">
        <span>© 2026 SwiftSign Labs, Inc.</span>
        <span>
          v0.4.1 ·{" "}
          <a href="#" className="footer-dim">
            changelog
          </a>
        </span>
      </div>
    </footer>
  );
}
