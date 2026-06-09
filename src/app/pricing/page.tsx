import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { Footer } from "@/components/landing/sections";
import { ArrowRight, Check } from "@/components/landing/icons";
import { SignupCta } from "@/components/landing/signup-cta";

export const metadata: Metadata = {
  title: "Pricing: $15/mo flat e-signature API · SwiftSign",
  description:
    "Sandbox is free forever with unlimited test envelopes. Pro is $15 a month per workspace, flat. Compare against DocuSign and Adobe list prices.",
};

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
    featured: true,
  },
];

const comparison = [
  {
    product: "SwiftSign Pro",
    price: "$15/mo",
    model: "Flat, per workspace",
    self: true,
  },
  {
    product: "DocuSign Standard",
    price: "$45/user/mo",
    model: "Per seat",
    self: false,
  },
  {
    product: "Adobe Acrobat Sign",
    price: "$29.99/mo",
    model: "Per license",
    self: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <NavBar />
      <main>
        <section className="hero" style={{ padding: "72px 0 40px" }}>
          <div className="dotgrid" />
          <div className="container hero-inner">
            <div className="eyebrow">Pricing</div>
            <h1
              className="hero-h1"
              style={{ fontSize: "clamp(40px, 5.2vw, 68px)", marginTop: 0 }}
            >
              Free to build.
              <br />
              <span className="hero-accent">$15 flat</span> to send.
            </h1>
            <p className="hero-sub">
              Sandbox envelopes are free forever. Live envelopes are $15 a
              month per workspace, flat. No seats, no envelope packs, no sales
              call.
            </p>
          </div>
        </section>

        <section className="pricing" style={{ padding: "16px 0 48px" }}>
          <div className="container">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                gap: 20,
                maxWidth: 760,
                margin: "0 auto",
              }}
            >
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={"price-card " + (p.featured ? "featured" : "")}
                >
                  {p.featured && <div className="price-badge mono">live</div>}
                  <div className="price-name mono">{p.name}</div>
                  <div className="price-amount">
                    <span className="price-num">{p.price}</span>
                    <span className="price-period mono">{p.period}</span>
                  </div>
                  <p className="price-blurb">{p.blurb}</p>
                  <ul className="price-features">
                    {p.features.map((f) => (
                      <li key={f}>
                        <span className="price-check">
                          <Check size={12} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.id === "sandbox" ? (
                    <div style={{ marginTop: "auto" }}>
                      <SignupCta label="Get a sandbox key" />
                    </div>
                  ) : (
                    <a href="#upgrade" className="btn btn-accent price-cta">
                      Upgrade from your terminal <ArrowRight />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div
              className="pricing-footnote mono"
              style={{ maxWidth: 760, marginTop: 28 }}
            >
              <span>
                <span className="pricing-footnote-label">Fair use:</span>
                100 live envelopes a month covers almost everyone. Past that,
                talk to us: <b>support@swiftsign.ca</b>
              </span>
            </div>
          </div>
        </section>

        <section style={{ padding: "48px 0 32px" }}>
          <div className="container">
            <div className="section-head" style={{ marginBottom: 32 }}>
              <div className="eyebrow">The math</div>
              <h2 style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>
                Flat beats per-seat.
              </h2>
              <p className="section-sub">
                A 5-person team on per-seat e-signature pays for 5 licenses.
                A workspace on SwiftSign pays for 1.
              </p>
            </div>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <table className="docs-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">List price</th>
                    <th scope="col">Pricing model</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.product}>
                      <td style={{ fontWeight: row.self ? 500 : 400 }}>
                        {row.product}
                      </td>
                      <td
                        className="mono"
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: row.self ? "var(--accent)" : "var(--ink-2)",
                          fontWeight: row.self ? 500 : 400,
                        }}
                      >
                        {row.price}
                      </td>
                      <td>{row.model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--ink-4)",
                  marginTop: 12,
                }}
              >
                List prices as of June 2026, from public pricing pages. Not
                affiliated with DocuSign or Adobe.
              </p>
            </div>
          </div>
        </section>

        <section
          id="upgrade"
          style={{ padding: "48px 0 110px", scrollMarginTop: 80 }}
        >
          <div className="container">
            <div className="section-head" style={{ marginBottom: 28 }}>
              <div className="eyebrow">Going live</div>
              <h2 style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>
                Upgrade from your terminal.
              </h2>
              <p className="section-sub">
                No pricing call. One API call returns a Stripe Checkout link,
                so your agent can initiate the upgrade and hand you the
                payment page.
              </p>
            </div>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <pre className="dev-card-code mono" style={{ margin: 0 }}>
                <code>{`const { checkout_url } = await ss.billing.upgrade({ plan: "PRO" });
// Open checkout_url, pay, then mint a sk_live_ key from the dashboard.`}</code>
              </pre>
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Link href="/docs" className="link-arrow">
                  Read the quickstart <ArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
