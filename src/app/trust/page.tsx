import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/landing/nav";
import { Footer } from "@/components/landing/sections";
import {
  Api,
  Check,
  Seal,
  Shield,
  Terminal,
  Webhook,
} from "@/components/landing/icons";

export const metadata: Metadata = {
  title: "Trust: signing mail, seals, and data · SwiftSign",
  description:
    "How SwiftSign protects documents: SPF, DKIM, and DMARC on signing mail, SHA-256 document hashing with a Certificate of Completion audit trail, data in Neon Postgres and Cloudflare R2, deletion on request.",
};

type TrustItem = {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: React.ReactNode;
  code?: string;
};

const items: TrustItem[] = [
  {
    icon: <Shield />,
    kicker: "Mail",
    title: "Email authentication",
    body: (
      <>
        Signing requests are sent from swiftsign.ca with SPF, DKIM, and DMARC,
        so receiving mail servers can verify the mail actually came from us.
        If a signing email fails authentication, treat it as phishing and
        report it.
      </>
    ),
  },
  {
    icon: <Seal />,
    kicker: "Integrity",
    title: "Document integrity",
    body: (
      <>
        Every completed document is hashed with SHA-256 and bound to a
        Certificate of Completion that records each signer&apos;s name, email,
        IP address, timestamp, and signature method, backed by a hash-chained,
        tamper-evident audit log. That record is what makes the signature
        legally binding under the U.S. ESIGN Act, UETA, and Canadian
        e-commerce law. Cryptographic in-PDF signing with a publicly-trusted
        certificate is available for live workspaces that need it.
      </>
    ),
    code: `digest:       SHA-256 over the final document bytes
audit trail:  signer name, email, IP, timestamp, method
chain:        hash-chained, tamper-evident audit log
artifacts:    sealed PDF + Certificate of Completion`,
  },
  {
    icon: <Api />,
    kicker: "Data",
    title: "Data location",
    body: (
      <>
        Documents and sealed PDFs are stored in Cloudflare R2. Accounts,
        envelopes, and audit records are stored in Neon Postgres. Traffic is
        HTTPS-only with HSTS.
      </>
    ),
  },
  {
    icon: <Check />,
    kicker: "Deletion",
    title: "Deletion on request",
    body: (
      <>
        Email support@swiftsign.ca from your account address and we delete
        your documents and account data, subject to legal retention limits.
        The same right is written into the{" "}
        <Link href="/legal/privacy" className="link-arrow">
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    icon: <Webhook />,
    kicker: "Abuse",
    title: "Abuse reporting",
    body: (
      <>
        Got a SwiftSign email you did not expect, or see the service being
        misused? Email abuse@swiftsign.ca with the message or envelope link.
        We investigate every report.
      </>
    ),
  },
  {
    icon: <Terminal />,
    kicker: "Limits",
    title: "New-account limits",
    body: (
      <>
        Signups are velocity-limited by IP, and new accounts get conservative
        rate limits on sending. That keeps bulk spam out of the signing
        channel and keeps signing mail deliverable.
      </>
    ),
  },
];

export default function TrustPage() {
  return (
    <>
      <NavBar />
      <main>
        <section className="hero" style={{ padding: "72px 0 40px" }}>
          <div className="dotgrid" />
          <div className="container hero-inner">
            <div className="eyebrow">Trust</div>
            <h1
              className="hero-h1"
              style={{ fontSize: "clamp(40px, 5.2vw, 68px)", marginTop: 0 }}
            >
              How we protect
              <br />
              <span className="hero-accent">your documents.</span>
            </h1>
            <p className="hero-sub">
              The mechanisms, written down: how signing mail is authenticated,
              how sealed PDFs prove integrity, where data lives, and who to
              email when something looks wrong.
            </p>
          </div>
        </section>

        <section style={{ padding: "16px 0 48px" }}>
          <div className="container">
            <div className="devgrid-cards">
              {items.map((item) => (
                <div key={item.kicker} className="dev-card">
                  <div className="dev-card-head">
                    <span className="dev-card-icon">{item.icon}</span>
                    <span className="dev-card-kicker mono">{item.kicker}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p style={{ fontSize: 14 }}>{item.body}</p>
                  {item.code && (
                    <pre className="dev-card-code mono">
                      <code>{item.code}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "32px 0 110px" }}>
          <div className="container">
            <div className="section-head" style={{ marginBottom: 28 }}>
              <div className="eyebrow">Compliance</div>
              <h2 style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>
                Built to hold up.
              </h2>
            </div>
            <div
              style={{
                maxWidth: 680,
                margin: "0 auto",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                alignItems: "center",
              }}
            >
              <p style={{ fontSize: 15 }}>
                Documents signed through SwiftSign are intended to be legally
                binding electronic signatures under applicable law, including
                the U.S. ESIGN Act and UETA and Canadian electronic-commerce
                legislation. Each completed envelope produces a Certificate of
                Completion recording the audit trail of the signing session.
                You are responsible for confirming that electronic signatures
                are valid for your specific document and jurisdiction.
              </p>
              <div className="hero-trust mono">
                <span>
                  <Shield size={12} /> Designed for ESIGN · UETA · Canadian e-sign laws
                </span>
                <span className="sep">·</span>
                <span>SHA-256 sealed PDFs</span>
              </div>
              <div className="hero-trust mono">
                <Link href="/legal/terms">Terms</Link>
                <span className="sep">·</span>
                <Link href="/legal/privacy">Privacy</Link>
                <span className="sep">·</span>
                <Link href="/legal/dpa">DPA</Link>
                <span className="sep">·</span>
                <Link href="/legal/acceptable-use">Acceptable use</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
