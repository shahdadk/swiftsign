import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Acceptable Use Policy · SwiftSign",
  description:
    "Rules that protect SwiftSign recipients, customers, infrastructure, and electronic-signature workflows from abuse.",
};

export default function AcceptableUsePage() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <div className="eyebrow">Legal</div>
        <h1>Acceptable Use Policy</h1>
        <p className="legal-version mono">
          Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="legal-lede">
          This policy is part of the{" "}
          <Link href="/legal/terms">Terms of Service</Link> and applies to every
          SwiftSign account, API key, integration, document, and signing
          request.
        </p>
      </header>

      <section>
        <h2>1. Lawful and authorized use</h2>
        <p>You may not use SwiftSign to:</p>
        <ul>
          <li>
            violate law, regulation, court order, contract, intellectual
            property, privacy, publicity, or other rights;
          </li>
          <li>
            impersonate a person or organization, forge authority, falsify an
            audit trail, or misrepresent who sent or signed a document;
          </li>
          <li>
            send fraudulent, deceptive, coercive, exploitative, or misleading
            documents or signing requests;
          </li>
          <li>
            sign on another person’s behalf without valid authorization; or
          </li>
          <li>
            use electronic execution for a document that applicable law
            excludes or subjects to unmet signing, consent, witnessing,
            notarization, delivery, or retention requirements.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Recipient protection and messaging</h2>
        <p>You may not:</p>
        <ul>
          <li>
            send unsolicited bulk signing requests, spam, phishing, malware,
            or messages unrelated to a legitimate document workflow;
          </li>
          <li>
            harvest, buy, or use recipient data without a lawful basis and
            appropriate notice;
          </li>
          <li>
            use misleading subject lines, sender identities, domains, or
            document descriptions;
          </li>
          <li>
            repeatedly contact a recipient who has objected, declined, or asked
            not to receive further requests; or
          </li>
          <li>
            use the service to threaten, harass, discriminate against, or
            exploit a person.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Sensitive and regulated data</h2>
        <p>
          You may not submit protected health information, full payment-card
          data, government identification numbers, financial-account
          credentials, biometric identifiers, children’s data, or other
          regulated or highly sensitive information unless you have confirmed
          that the service, your plan, and your configuration are appropriate
          and you have all required agreements, notices, consents, and
          safeguards.
        </p>
        <p>
          SwiftSign is not represented as compliant with a specialized regime
          such as HIPAA, PCI DSS storage requirements, or qualified electronic
          signatures under eIDAS unless SwiftSign has expressly agreed to that
          use in writing.
        </p>
      </section>

      <section>
        <h2>4. System and service integrity</h2>
        <p>You may not:</p>
        <ul>
          <li>
            probe, scan, or test the service for vulnerabilities without
            written authorization;
          </li>
          <li>
            disrupt the service, introduce malicious code, or interfere with
            another user or recipient;
          </li>
          <li>
            bypass authentication, confirmation gates, rate limits, quotas,
            plan restrictions, or safety controls;
          </li>
          <li>
            reverse engineer the hosted service except where the restriction is
            prohibited by law;
          </li>
          <li>
            use automated means that impose an unreasonable load or create
            abusive sending patterns; or
          </li>
          <li>
            resell, sublicense, or provide shared access to the service except
            as permitted by your plan or a written agreement.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Enforcement</h2>
        <p>
          We may investigate suspected violations and may rate-limit, block,
          remove, quarantine, or preserve content; revoke credentials; or
          suspend or terminate access. We consider the severity, recurrence,
          recipient impact, legal risk, and whether immediate action is needed
          to protect people or systems. Where appropriate, we will provide
          notice and an opportunity to respond.
        </p>
        <p>
          We may report suspected unlawful conduct to affected parties or
          authorities and preserve relevant information as permitted or
          required by law.
        </p>
      </section>

      <section>
        <h2>6. Reporting abuse</h2>
        <p>
          Report suspicious signing mail, fraudulent documents, impersonation,
          or other abuse to{" "}
          <a href="mailto:abuse@swiftsign.ca">abuse@swiftsign.ca</a>. Include
          the envelope link or message headers when safe to do so. For
          account-support questions, email{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>.
        </p>
      </section>
    </main>
  );
}
