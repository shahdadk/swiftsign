import Link from 'next/link';
import { DPA_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'SwiftSign — Data Processing Addendum',
};

export default function DpaPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Processing Addendum</h1>
      <p className="text-sm text-gray-500 mb-10">
        Version {DPA_VERSION} · Last updated {DPA_VERSION}
      </p>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">1. Scope</h2>
        <p>
          This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of the agreement between you
          (the &ldquo;Controller&rdquo;) and SwiftSign (the &ldquo;Processor&rdquo;) and applies when
          SwiftSign processes personal data on your behalf in providing the service. Where it conflicts
          with our{' '}
          <Link href="/legal/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>{' '}
          on data processing, this DPA controls.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">2. Roles and instructions</h2>
        <p>
          You are the controller of the personal data you submit (for example, recipient names and
          emails). SwiftSign is the processor and will process that data only to provide the service,
          per your documented instructions and these Terms, and as required by law.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">3. Confidentiality and security</h2>
        <p>
          SwiftSign ensures that personnel authorized to process personal data are bound by
          confidentiality and implements appropriate technical and organizational measures to protect
          the data against unauthorized access, loss, or disclosure.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">4. Subprocessors</h2>
        <p>
          You authorize SwiftSign to engage subprocessors (such as hosting, storage, and email
          providers) to deliver the service. SwiftSign imposes data-protection obligations on its
          subprocessors that are no less protective than those in this DPA and remains responsible for
          their performance.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">5. Data subject requests and breaches</h2>
        <p>
          SwiftSign will assist you, taking into account the nature of processing, in responding to
          requests from individuals to exercise their rights, and will notify you without undue delay
          after becoming aware of a personal data breach affecting your data.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">6. Deletion and return</h2>
        <p>
          On termination of the service, SwiftSign will delete or return personal data processed on
          your behalf, except where retention is required by law (for example, signing audit records
          that support the validity of completed envelopes).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">7. Contact</h2>
        <p>
          To discuss this DPA or request a countersigned copy, email{' '}
          <a href="mailto:support@swiftsign.ca" className="text-blue-600 hover:underline">
            support@swiftsign.ca
          </a>
          .
        </p>
      </section>
    </main>
  );
}
