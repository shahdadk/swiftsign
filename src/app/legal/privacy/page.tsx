import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED, PRIVACY_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · SwiftSign",
  description:
    "How SwiftSign collects, uses, shares, protects, retains, and deletes personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <div className="eyebrow">Legal</div>
        <h1>Privacy Policy</h1>
        <p className="legal-version mono">
          Version {PRIVACY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="legal-lede">
          This policy explains how SwiftSign handles personal information
          across the website, dashboard, API, MCP server, document-delivery,
          and signing experiences.
        </p>
      </header>

      <section>
        <h2>1. Scope and our role</h2>
        <p>
          This policy applies when SwiftSign determines why and how personal
          information is processed, such as account, billing, support, website,
          and service-security data.
        </p>
        <p>
          For documents, recipient details, fields, and signing workflows
          submitted by a customer, the customer generally determines the
          purpose of processing and SwiftSign processes the information on the
          customer’s behalf. If you received a signing request, contact the
          sender first for questions about the document or their use of your
          information. Our{" "}
          <Link href="/legal/dpa">Data Processing Addendum</Link> covers that
          processor relationship.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address,
            authentication records, organization details, settings, API-key
            metadata, and session information.
          </li>
          <li>
            <strong>Billing information:</strong> plan, subscription, invoice,
            billing-contact, and transaction status. Payment-card details are
            collected and processed by Stripe rather than stored by SwiftSign.
          </li>
          <li>
            <strong>Document and workflow information:</strong> uploaded files,
            templates, document URLs, recipient names and email addresses,
            routing order, fields, field values, messages, and webhook
            configuration.
          </li>
          <li>
            <strong>Signing and audit information:</strong> consent records,
            signatures, timestamps, IP address, user agent, approximate
            location derived from network information, signing method, document
            hashes, and events used to create the audit trail and Certificate
            of Completion.
          </li>
          <li>
            <strong>Usage and device information:</strong> API requests,
            feature use, pages viewed, diagnostic events, request identifiers,
            browser and device data, and rate-limit or abuse-prevention signals.
          </li>
          <li>
            <strong>Communications:</strong> support requests, feedback, abuse
            reports, and other correspondence.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Sources of information</h2>
        <p>
          We collect information directly from account holders and signers,
          from customers that send documents or use the API, automatically from
          browsers, devices, and service activity, and from providers involved
          in authentication, billing, email delivery, hosting, security, and
          support.
        </p>
      </section>

      <section>
        <h2>4. How we use information</h2>
        <p>We use personal information to:</p>
        <ul>
          <li>
            create and secure accounts, authenticate users, and manage API
            access;
          </li>
          <li>
            prepare, send, display, sign, seal, store, verify, and deliver
            documents;
          </li>
          <li>
            generate signing audit trails and Certificates of Completion;
          </li>
          <li>
            process subscriptions, invoices, and account administration;
          </li>
          <li>
            send service, security, signing, and transactional communications;
          </li>
          <li>
            prevent spam, fraud, credential abuse, and other prohibited
            activity;
          </li>
          <li>
            troubleshoot, monitor reliability, support users, and improve the
            service; and
          </li>
          <li>
            comply with law, enforce agreements, and establish, exercise, or
            defend legal claims.
          </li>
        </ul>
        <p>
          Depending on the context and applicable law, we rely on performance
          of a contract, consent, compliance with legal obligations, and our
          legitimate interests in operating and securing the service. Where we
          rely on consent, it may be withdrawn subject to legal and contractual
          limits.
        </p>
      </section>

      <section>
        <h2>5. Cookies and similar technology</h2>
        <p>
          SwiftSign uses cookies and comparable local-storage or session
          technologies that are necessary to authenticate users, protect
          accounts, remember service state, and operate the dashboard and
          signing flow. We do not use this information to sell personal
          information or for cross-context behavioural advertising.
        </p>
        <p>
          You can control cookies through your browser, but blocking necessary
          cookies may prevent sign-in or other service features from working.
        </p>
      </section>

      <section>
        <h2>6. How we disclose information</h2>
        <p>We may disclose information:</p>
        <ul>
          <li>
            to senders, recipients, account administrators, and other
            participants as required by the document workflow;
          </li>
          <li>
            to service providers that host, store, transmit, bill, secure,
            monitor, or support SwiftSign, listed on our{" "}
            <Link href="/legal/subprocessors">Subprocessors page</Link>;
          </li>
          <li>
            when required by law or reasonably necessary to protect rights,
            safety, users, recipients, or service integrity;
          </li>
          <li>
            in connection with a merger, financing, reorganization, or sale,
            subject to appropriate confidentiality protections; and
          </li>
          <li>with your direction or consent.</li>
        </ul>
        <p>
          We do not sell personal information. We do not share personal
          information for cross-context behavioural advertising.
        </p>
      </section>

      <section>
        <h2>7. International processing</h2>
        <p>
          SwiftSign and its service providers may process information outside
          your province, state, or country. As a result, information may be
          subject to the laws and lawful-access requirements of those
          jurisdictions. Where required, we use contractual and other
          safeguards for cross-border transfers.
        </p>
      </section>

      <section>
        <h2>8. Retention and deletion</h2>
        <p>
          We retain personal information only as long as reasonably necessary
          for the purposes described in this policy, including to provide the
          service, preserve account and signing records, comply with law,
          resolve disputes, prevent abuse, and enforce agreements. Retention
          depends on the data, account status, customer instructions, legal
          requirements, and whether a record forms part of a completed signing
          audit trail.
        </p>
        <p>
          Account holders may request deletion by emailing{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a> from
          their account address. We may retain limited information when
          required by law or necessary for security, fraud prevention, payment
          records, legal claims, or the integrity of completed transactions.
          Backup copies are deleted on their normal rotation schedule.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards
          designed to protect personal information, including encrypted
          transport, access controls, credential hashing, audit records,
          rate-limiting, and service monitoring. No system is completely
          secure, and we cannot guarantee absolute security.
        </p>
        <p>
          If you believe an account, API key, signing link, or document has
          been compromised, contact{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>{" "}
          promptly.
        </p>
      </section>

      <section>
        <h2>10. Your privacy choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete, or obtain a copy of personal information; withdraw consent;
          restrict or object to processing; or complain to a privacy regulator.
          We will not discriminate against you for exercising a privacy right.
        </p>
        <p>
          Send a request to{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>. We may
          need to verify your identity and authority before completing it. If
          SwiftSign holds the information only for a customer, we may refer the
          request to that customer. Rights may be limited by law and by the
          rights of other people.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          SwiftSign is a business service and is not directed to children. We
          do not knowingly collect personal information from a child who cannot
          lawfully consent to the processing. If you believe a child has
          provided information improperly, contact us.
        </p>
      </section>

      <section>
        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy as the service or law changes. The version
          and date above show the latest revision. We will provide additional
          notice of material changes when required.
        </p>
      </section>

      <section>
        <h2>13. Contact and complaints</h2>
        <p>
          Questions, requests, or complaints may be sent to our privacy contact
          at <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>. We
          will investigate and respond within the time required by applicable
          law.
        </p>
        <p>
          You may also have the right to complain to the Office of the Privacy
          Commissioner of Canada or another privacy authority in your
          jurisdiction.
        </p>
      </section>
    </main>
  );
}
