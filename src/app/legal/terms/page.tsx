import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED, TOS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service · SwiftSign",
  description:
    "Terms governing SwiftSign accounts, APIs, electronic-signature workflows, paid plans, and acceptable use.",
};

export default function TermsPage() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <div className="eyebrow">Legal</div>
        <h1>Terms of Service</h1>
        <p className="legal-version mono">
          Version {TOS_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="legal-lede">
          These Terms govern access to SwiftSign’s website, dashboard, API,
          software development kits, MCP server, and electronic-signature
          services.
        </p>
      </header>

      <section>
        <h2>1. Agreement and eligibility</h2>
        <p>
          These Terms are an agreement between you and SwiftSign
          (&ldquo;SwiftSign,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;). By creating an account, obtaining or using an API
          key, or otherwise using the service, you agree to these Terms. If you
          use the service for an organization, you represent that you have
          authority to bind that organization.
        </p>
        <p>
          You must be legally capable of entering a binding contract and at
          least the age of majority where you live. The service is not directed
          to children.
        </p>
      </section>

      <section>
        <h2>2. Accounts and credentials</h2>
        <p>
          You must provide accurate information and keep account, API-key,
          signing-link, and session credentials confidential. You are
          responsible for activity under your account and must promptly notify
          us at{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a> if you
          suspect unauthorized access.
        </p>
        <p>
          Sandbox credentials are for testing. Sandbox documents may be
          watermarked and are not intended for legally binding transactions.
          You may not bypass plan limits by creating multiple accounts or
          credentials.
        </p>
      </section>

      <section>
        <h2>3. The service and electronic signatures</h2>
        <p>
          SwiftSign provides tools for preparing, sending, signing, tracking,
          storing, and verifying electronic documents. We are a technology
          provider, not a party to documents between senders and recipients,
          and we do not provide legal advice.
        </p>
        <p>
          Electronic signatures can have legal effect under laws such as the
          U.S. ESIGN Act and UETA and Canadian electronic-commerce legislation.
          Those laws include requirements and exceptions that depend on the
          document, parties, disclosures, consent, and jurisdiction. You are
          responsible for determining whether electronic signatures and
          SwiftSign are appropriate for your transaction and for providing any
          legally required consumer disclosures, consent, paper-copy options,
          or record-retention access.
        </p>
        <p>
          Do not use SwiftSign for documents that applicable law excludes from
          electronic execution or requires to be signed, witnessed, notarized,
          delivered, or retained in a different way unless you have confirmed
          that your workflow satisfies those requirements.
        </p>
      </section>

      <section>
        <h2>4. Customer content and responsibilities</h2>
        <p>
          You retain ownership of documents, templates, recipient information,
          field values, signatures, and other material you submit
          (&ldquo;Customer Content&rdquo;). You give SwiftSign a limited licence
          to host, copy, transmit, render, seal, and otherwise process Customer
          Content only as needed to operate, secure, support, and improve the
          service and meet legal obligations.
        </p>
        <p>You represent and warrant that:</p>
        <ul>
          <li>
            you have the rights and lawful basis needed to submit and process
            Customer Content;
          </li>
          <li>
            recipients have been properly identified and may lawfully receive
            the documents you send;
          </li>
          <li>
            your documents, signing requests, and communications comply with
            privacy, electronic-signature, consumer-protection, and anti-spam
            laws; and
          </li>
          <li>
            you will review agent-generated drafts and field placement before
            authorizing live sends.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>
          You must comply with the{" "}
          <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>, which
          is incorporated into these Terms. We may investigate suspected abuse,
          limit sending, remove unlawful content, or suspend access when
          reasonably necessary to protect recipients, customers, SwiftSign, or
          the service.
        </p>
      </section>

      <section>
        <h2>6. Paid plans, renewals, and taxes</h2>
        <p>
          Paid-plan prices, included usage, and billing periods are shown at
          checkout or on the{" "}
          <Link href="/pricing">pricing page</Link>. Subscriptions renew
          automatically for the same period until cancelled. You authorize us
          and our payment processor to charge the payment method on file for
          recurring fees and applicable taxes.
        </p>
        <p>
          You may cancel before the next renewal through the billing portal.
          Unless required by law or stated otherwise at checkout, charges
          already paid are non-refundable and cancellation takes effect at the
          end of the current billing period. We may change future prices with
          advance notice; a price change will apply no earlier than your next
          renewal after the notice period.
        </p>
      </section>

      <section>
        <h2>7. Privacy and data processing</h2>
        <p>
          The <Link href="/legal/privacy">Privacy Policy</Link> describes how we
          handle personal information. When SwiftSign processes personal data
          on a customer’s behalf, the{" "}
          <Link href="/legal/dpa">Data Processing Addendum</Link> applies. Our
          current providers are listed on the{" "}
          <Link href="/legal/subprocessors">Subprocessors page</Link>.
        </p>
      </section>

      <section>
        <h2>8. SwiftSign technology and feedback</h2>
        <p>
          SwiftSign and its licensors retain all rights in the service,
          software, designs, documentation, and trademarks other than Customer
          Content. Subject to these Terms, we grant you a limited,
          non-exclusive, non-transferable, revocable right to use the service
          during your account term.
        </p>
        <p>
          If you provide suggestions or feedback, you allow us to use it
          without restriction or compensation. Open-source components remain
          governed by their applicable licences.
        </p>
      </section>

      <section>
        <h2>9. Third-party services</h2>
        <p>
          The service may interoperate with third-party products and websites.
          Their terms and privacy practices govern your use of them. We are not
          responsible for third-party services, including their availability,
          security, or changes.
        </p>
      </section>

      <section>
        <h2>10. Availability and changes</h2>
        <p>
          We work to keep SwiftSign reliable, but the service may be
          unavailable because of maintenance, incidents, provider outages, or
          events beyond our reasonable control. We may add, change, or
          discontinue features. If a change materially reduces the core
          functionality of a paid plan, we will provide reasonable notice when
          practicable.
        </p>
      </section>

      <section>
        <h2>11. Suspension and termination</h2>
        <p>
          You may stop using SwiftSign or cancel your account at any time. We
          may suspend or terminate access if you materially breach these Terms,
          create security or legal risk, fail to pay, or use the service in a
          way that threatens recipients or service integrity. Where
          appropriate, we will provide notice and a reasonable opportunity to
          cure.
        </p>
        <p>
          After termination, your right to use the service ends. Provisions
          that by their nature should survive—including payment obligations,
          ownership, disclaimers, liability limits, and dispute terms—will
          survive. Data deletion and retention are governed by the Privacy
          Policy and DPA.
        </p>
      </section>

      <section>
        <h2>12. Disclaimers</h2>
        <p>
          To the maximum extent permitted by law, the service is provided
          &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; SwiftSign
          disclaims implied warranties of merchantability, fitness for a
          particular purpose, non-infringement, and uninterrupted or error-free
          operation. We do not warrant that a particular document or signing
          method will be valid or enforceable in every jurisdiction or use
          case.
        </p>
        <p>
          Nothing in these Terms excludes warranties, remedies, or other rights
          that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>13. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, neither party will be liable
          for indirect, incidental, special, consequential, exemplary, or
          punitive damages, or loss of profits, revenues, goodwill, or data,
          arising from the service, even if advised that such damages were
          possible.
        </p>
        <p>
          SwiftSign’s total aggregate liability arising out of or relating to
          the service will not exceed the greater of (a) the fees you paid to
          SwiftSign during the 12 months before the event giving rise to the
          claim or (b) CAD $100. These limits do not apply where prohibited by
          law.
        </p>
      </section>

      <section>
        <h2>14. Indemnity</h2>
        <p>
          To the extent permitted by law, you will defend and indemnify
          SwiftSign from third-party claims, damages, and reasonable costs
          arising from your Customer Content, your breach of these Terms, or
          your unlawful or unauthorized use of the service.
        </p>
      </section>

      <section>
        <h2>15. Governing law</h2>
        <p>
          These Terms are governed by the laws of Ontario and the federal laws
          of Canada applicable there, without regard to conflict-of-law rules.
          The courts located in Toronto, Ontario have exclusive jurisdiction,
          except where applicable consumer law gives you the right to bring a
          claim elsewhere.
        </p>
      </section>

      <section>
        <h2>16. Changes to these Terms</h2>
        <p>
          We may update these Terms. If a change is material, we will provide
          notice through the service, by email, or by another reasonable
          method. The version and date above show when these Terms last
          changed. Continued use after updated Terms take effect constitutes
          acceptance; where required, we will ask you to accept them again.
        </p>
      </section>

      <section>
        <h2>17. General and contact</h2>
        <p>
          If any provision is unenforceable, the remaining provisions continue
          in effect. A failure to enforce a provision is not a waiver. You may
          not assign these Terms without our consent; we may assign them as
          part of a merger, financing, reorganization, or sale of the service.
          These Terms and incorporated policies are the entire agreement about
          the service unless you and SwiftSign sign a separate agreement.
        </p>
        <p>
          Questions or legal notices may be sent to{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>.
        </p>
      </section>
    </main>
  );
}
