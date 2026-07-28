import type { Metadata } from "next";
import Link from "next/link";
import { DPA_VERSION, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Processing Addendum · SwiftSign",
  description:
    "Data-processing terms that apply when SwiftSign processes personal data on a customer’s behalf.",
};

export default function DpaPage() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <div className="eyebrow">Legal</div>
        <h1>Data Processing Addendum</h1>
        <p className="legal-version mono">
          Version {DPA_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="legal-lede">
          This DPA forms part of the agreement between a customer and SwiftSign
          when SwiftSign processes personal data on that customer’s behalf.
        </p>
      </header>

      <section>
        <h2>1. Scope and precedence</h2>
        <p>
          This Data Processing Addendum (&ldquo;DPA&rdquo;) is incorporated into
          the <Link href="/legal/terms">Terms of Service</Link> or another
          written agreement governing the customer’s use of SwiftSign
          (together, the &ldquo;Agreement&rdquo;). It applies to customer
          personal data that SwiftSign processes as a processor or service
          provider on the customer’s behalf.
        </p>
        <p>
          If this DPA conflicts with the Agreement on processing customer
          personal data, this DPA controls. Terms such as
          &ldquo;controller,&rdquo; &ldquo;processor,&rdquo; &ldquo;personal
          data,&rdquo; and &ldquo;processing&rdquo; have the meanings given by
          applicable data-protection law.
        </p>
      </section>

      <section>
        <h2>2. Roles and instructions</h2>
        <p>
          The customer is the controller or the party acting on the
          controller’s instructions. SwiftSign is the processor. The customer
          instructs SwiftSign to process customer personal data to provide,
          secure, support, and maintain the service, as described in the
          Agreement, this DPA, the customer’s use and configuration of the
          service, and other documented instructions agreed by the parties.
        </p>
        <p>
          SwiftSign will process customer personal data only on those
          documented instructions unless applicable law requires otherwise. If
          law permits, SwiftSign will notify the customer before processing
          required by law. SwiftSign will promptly inform the customer if, in
          its opinion, an instruction infringes applicable data-protection law.
        </p>
        <p>
          The customer is responsible for the lawfulness of its instructions,
          notices, disclosures, consents, and collection and use of customer
          personal data.
        </p>
      </section>

      <section>
        <h2>3. Processing details</h2>
        <h3>Subject matter and duration</h3>
        <p>
          Processing necessary to provide SwiftSign’s document preparation,
          delivery, electronic-signature, storage, audit, verification, API,
          MCP, webhook, and support functions for the term of the Agreement and
          any limited post-termination period described below.
        </p>
        <h3>Nature and purpose</h3>
        <p>
          Receiving, hosting, organizing, rendering, transmitting, displaying,
          collecting, recording, signing, sealing, hashing, storing, retrieving,
          supporting, securing, deleting, and returning data as directed by the
          customer.
        </p>
        <h3>Categories of data subjects</h3>
        <p>
          Customer personnel and contractors; document senders, recipients,
          signers, approvers, and carbon-copy recipients; and individuals whose
          personal data is included in documents or support communications.
        </p>
        <h3>Types of personal data</h3>
        <p>
          Names, email addresses, organization and role information, document
          content, field values, signatures, consent records, timestamps, IP
          addresses, user agents, approximate network-derived location, signing
          method, audit events, customer identifiers, and other personal data
          that the customer submits to the service.
        </p>
        <h3>Sensitive data</h3>
        <p>
          SwiftSign does not require special-category or highly sensitive data
          to provide the service. The customer must not submit it unless the
          customer has a lawful basis, has configured appropriate safeguards,
          and the processing is permitted under the Agreement.
        </p>
      </section>

      <section>
        <h2>4. Confidentiality and personnel</h2>
        <p>
          SwiftSign will ensure that personnel authorized to process customer
          personal data are subject to confidentiality obligations and receive
          access only as needed for their responsibilities. SwiftSign remains
          responsible for its personnel’s compliance with this DPA.
        </p>
      </section>

      <section>
        <h2>5. Security</h2>
        <p>
          Taking into account the state of the art, implementation costs, and
          the nature, scope, context, and purposes of processing, SwiftSign will
          maintain appropriate technical and organizational measures designed
          to protect customer personal data against accidental or unlawful
          destruction, loss, alteration, unauthorized disclosure, or access.
        </p>
        <p>
          Measures include, as appropriate, encrypted transport, logical access
          controls, credential hashing, audit logging, document-integrity
          hashing, rate limiting, monitoring, secret scrubbing, backups, and
          incident-response procedures. Additional public information is
          available on the <Link href="/trust">Trust page</Link>.
        </p>
      </section>

      <section>
        <h2>6. Subprocessors</h2>
        <p>
          The customer gives SwiftSign general authorization to use
          subprocessors to provide the service. Current subprocessors and their
          functions are listed on the{" "}
          <Link href="/legal/subprocessors">Subprocessors page</Link>. SwiftSign
          will impose data-protection obligations appropriate to the processing
          on each subprocessor and remains responsible for its subprocessor’s
          performance to the extent required by applicable law.
        </p>
        <p>
          SwiftSign will post material subprocessor changes before the new
          provider begins processing where reasonably practicable. A customer
          may object on reasonable data-protection grounds by contacting
          SwiftSign. The parties will work in good faith on a commercially
          reasonable resolution; if none is available, the customer may stop
          the affected processing and terminate the affected service.
        </p>
      </section>

      <section>
        <h2>7. Data-subject requests</h2>
        <p>
          Taking into account the nature of processing, SwiftSign will provide
          reasonable assistance to help the customer respond to requests to
          exercise privacy rights. If SwiftSign receives a request relating to
          customer personal data, it will redirect the requester to the
          customer or notify the customer and will not respond substantively
          unless instructed or legally required.
        </p>
      </section>

      <section>
        <h2>8. Security incidents</h2>
        <p>
          SwiftSign will notify the customer without undue delay after becoming
          aware of a confirmed personal-data breach affecting customer personal
          data. The notice will include information reasonably available to
          SwiftSign about the nature of the incident, affected data, likely
          consequences, and mitigation steps. SwiftSign will take reasonable
          steps to contain, investigate, and remediate the incident.
        </p>
        <p>
          Notification is not an admission of fault or liability. The customer
          is responsible for regulatory and data-subject notifications required
          of the controller.
        </p>
      </section>

      <section>
        <h2>9. Compliance assistance</h2>
        <p>
          Taking into account the nature of processing and information
          available to SwiftSign, SwiftSign will provide reasonable assistance
          with the customer’s data-security, breach-notification,
          data-protection-impact-assessment, and prior-consultation obligations.
          Assistance beyond standard service functionality may be subject to
          reasonable fees agreed in advance.
        </p>
      </section>

      <section>
        <h2>10. International transfers</h2>
        <p>
          SwiftSign and its subprocessors may process customer personal data in
          countries other than the customer’s country. The parties will comply
          with transfer requirements that apply to them. Where an approved
          contractual transfer mechanism is required, the parties will
          cooperate in good faith to put it in place.
        </p>
      </section>

      <section>
        <h2>11. Deletion and return</h2>
        <p>
          During the term, the customer may access or export data using
          available service functionality. On termination and on the
          customer’s written request, SwiftSign will delete or return customer
          personal data within a reasonable period, except for data that must
          be retained by law or is reasonably necessary to preserve security,
          payment, dispute, or completed signing-audit records. Retained data
          remains protected by this DPA and is deleted when the retention basis
          ends. Backup copies are deleted on normal rotation.
        </p>
      </section>

      <section>
        <h2>12. Information and audits</h2>
        <p>
          SwiftSign will make information reasonably necessary to demonstrate
          compliance with this DPA available to the customer. If that
          information is insufficient, the customer may request an audit no
          more than once annually, or following a material security incident or
          regulator request, on reasonable advance notice.
        </p>
        <p>
          Audits must protect other customers’ information, avoid unreasonable
          disruption, and be subject to confidentiality. The customer bears its
          audit costs and will reimburse SwiftSign’s reasonable costs unless
          the audit identifies a material breach by SwiftSign.
        </p>
      </section>

      <section>
        <h2>13. Liability and termination</h2>
        <p>
          Each party’s liability under this DPA is subject to the Agreement’s
          exclusions and limitations of liability unless applicable law
          requires otherwise. This DPA ends when SwiftSign no longer processes
          customer personal data, except for provisions that must survive to
          protect retained data.
        </p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <p>
          To ask a data-processing question or request a signed copy of this
          DPA, email{" "}
          <a href="mailto:support@swiftsign.ca">support@swiftsign.ca</a>.
        </p>
      </section>
    </main>
  );
}
