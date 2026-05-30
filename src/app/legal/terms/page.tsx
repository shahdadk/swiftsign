import Link from 'next/link';
import { TOS_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'SwiftSign — Terms of Service',
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">
        Version {TOS_VERSION} · Last updated {TOS_VERSION}
      </p>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">1. The service</h2>
        <p>
          SwiftSign (&ldquo;SwiftSign&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides software for sending,
          signing, and storing electronic documents over the web, an API, and an MCP server. These
          Terms govern your access to and use of the SwiftSign service at swiftsign.ca.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">2. Accounts</h2>
        <p>
          You must provide an accurate email address to create an account and are responsible for all
          activity that occurs under your account and API keys. Keep your credentials confidential.
          You must be at least the age of majority in your jurisdiction and able to form a binding
          contract.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">3. Acceptable use</h2>
        <p>
          You agree not to misuse the service. Prohibited conduct is described in our{' '}
          <Link href="/legal/acceptable-use" className="text-blue-600 hover:underline">
            Acceptable Use Policy
          </Link>
          , which is incorporated into these Terms by reference.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">4. Electronic signatures</h2>
        <p>
          Documents signed through SwiftSign are intended to be legally binding electronic signatures
          under applicable law, including the U.S. ESIGN Act and UETA and Canada&rsquo;s PIPEDA. By
          signing through the service you consent to transact electronically. Each completed envelope
          produces a Certificate of Completion recording the audit trail of the signing session. You
          are responsible for confirming that electronic signatures are valid for your specific
          document and jurisdiction.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">5. Data handling</h2>
        <p>
          Our handling of personal information is described in our{' '}
          <Link href="/legal/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          . Where SwiftSign processes personal data on your behalf, the{' '}
          <Link href="/legal/dpa" className="text-blue-600 hover:underline">
            Data Processing Addendum
          </Link>{' '}
          applies.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">6. Disclaimers and liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties of any kind, express or
          implied. To the maximum extent permitted by law, SwiftSign is not liable for any indirect,
          incidental, or consequential damages, and our total liability for any claim is limited to
          the amount you paid us in the twelve months preceding the claim. SwiftSign is not a law
          firm and does not provide legal advice.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">7. Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate your access if you
          breach these Terms or use the service in a way that creates risk or legal exposure for us or
          others. Provisions that by their nature should survive termination will survive.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">8. Changes</h2>
        <p>
          We may update these Terms from time to time. When we do, we will bump the version above and
          may ask you to re-accept. Continued use after a change means you accept the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">9. Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a href="mailto:support@swiftsign.ca" className="text-blue-600 hover:underline">
            support@swiftsign.ca
          </a>
          .
        </p>
      </section>
    </main>
  );
}
