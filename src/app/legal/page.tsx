import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Shield } from "@/components/landing/icons";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal center · SwiftSign",
  description:
    "SwiftSign terms, privacy practices, data-processing terms, acceptable-use rules, and subprocessor disclosures.",
};

const documents = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    body: "The agreement that governs accounts, API access, payments, electronic-signature workflows, and use of SwiftSign.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    body: "What personal information we collect, why we use it, who processes it, how long it is kept, and your choices.",
  },
  {
    href: "/legal/dpa",
    title: "Data Processing Addendum",
    body: "The controller–processor terms that apply when SwiftSign processes personal data on a customer’s behalf.",
  },
  {
    href: "/legal/acceptable-use",
    title: "Acceptable Use Policy",
    body: "The safety, anti-abuse, and system-integrity rules that apply to every account and API key.",
  },
  {
    href: "/legal/subprocessors",
    title: "Subprocessors",
    body: "The infrastructure, storage, email, billing, security, and monitoring providers used to operate the service.",
  },
  {
    href: "/trust",
    title: "Trust & security",
    body: "A plain-language summary of document integrity, signing audit trails, data storage, deletion, and abuse reporting.",
  },
];

export default function LegalPage() {
  return (
    <main className="legal-index">
      <div className="legal-index-hero">
        <div className="eyebrow">Legal center</div>
        <h1>Clear rules. Plain language.</h1>
        <p>
          The documents below explain the terms that apply to SwiftSign and how
          we handle account, document, recipient, and signing data.
        </p>
        <div className="legal-updated mono">
          <Shield size={12} /> Last updated {LEGAL_LAST_UPDATED}
        </div>
      </div>

      <div className="legal-card-grid">
        {documents.map((document) => (
          <Link key={document.href} href={document.href} className="legal-card">
            <h2>{document.title}</h2>
            <p>{document.body}</p>
            <span className="link-arrow">
              Read document <ArrowRight />
            </span>
          </Link>
        ))}
      </div>

      <div className="legal-contact">
        <h2>Questions or privacy requests</h2>
        <p>
          Email{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>. For
          suspected abuse, email{" "}
          <a href="mailto:abuse@swiftsign.ca">abuse@swiftsign.ca</a>.
        </p>
      </div>
    </main>
  );
}
