import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Subprocessors · SwiftSign",
  description:
    "Third-party service providers SwiftSign uses for hosting, storage, email, billing, rate limiting, and error monitoring.",
};

const subprocessors = [
  {
    provider: "Vercel",
    purpose: "Application hosting, edge delivery, and operational logs",
    data: "Account, request, device, and service-usage data",
  },
  {
    provider: "Neon",
    purpose: "Managed PostgreSQL database infrastructure",
    data: "Account, envelope, recipient, signing-audit, and configuration data",
  },
  {
    provider: "Cloudflare",
    purpose: "R2 document and generated-file storage",
    data: "Uploaded documents, page images, signed documents, and certificates",
  },
  {
    provider: "Resend",
    purpose: "Transactional email delivery",
    data: "Sender and recipient email addresses, message content, and delivery events",
  },
  {
    provider: "Stripe",
    purpose: "Subscription billing, checkout, invoices, and payment administration",
    data: "Customer, billing, subscription, and payment-related data",
  },
  {
    provider: "Upstash",
    purpose: "Rate limiting and service-abuse prevention",
    data: "Network identifiers and request-rate metadata",
  },
  {
    provider: "Sentry",
    purpose: "Error reporting, diagnostics, and service reliability",
    data: "Error, request, device, and diagnostic data with secrets scrubbed",
  },
];

export default function SubprocessorsPage() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <div className="eyebrow">Legal</div>
        <h1>Subprocessors</h1>
        <p className="legal-version mono">Last updated {LEGAL_LAST_UPDATED}</p>
        <p className="legal-lede">
          SwiftSign uses the providers below to operate the service. They may
          process customer personal data only to provide their contracted
          services to SwiftSign.
        </p>
      </header>

      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">Purpose</th>
              <th scope="col">Data involved</th>
            </tr>
          </thead>
          <tbody>
            {subprocessors.map((subprocessor) => (
              <tr key={subprocessor.provider}>
                <td>{subprocessor.provider}</td>
                <td>{subprocessor.purpose}</td>
                <td>{subprocessor.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2>Changes and objections</h2>
        <p>
          We may update this list as the service changes. Material changes will
          be posted here before the new provider begins processing customer
          personal data where reasonably practicable. Customers with a
          reasonable data-protection objection should email{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>.
        </p>
      </section>

      <section>
        <h2>Contractual protections</h2>
        <p>
          We require subprocessors to protect personal data and process it only
          for the services they provide to us. The{" "}
          <Link href="/legal/dpa">Data Processing Addendum</Link> explains the
          terms that apply when SwiftSign processes personal data for a
          customer.
        </p>
      </section>
    </main>
  );
}
