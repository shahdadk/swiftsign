import Link from 'next/link';
import { PRIVACY_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'SwiftSign — Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">
        Version {PRIVACY_VERSION} · Last updated {PRIVACY_VERSION}
      </p>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">1. Overview</h2>
        <p>
          This policy explains what personal information SwiftSign collects, how we use it, and the
          choices you have. It applies to the SwiftSign service at swiftsign.ca, including the web
          dashboard, API, and MCP server.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">2. Information we collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Account data: your email address and authentication records.</li>
          <li>Document data: the files you upload, recipient names and emails, and field values.</li>
          <li>
            Signing audit data: timestamps, IP address, user agent, and approximate location of each
            signing session, captured to support the legal validity of signatures.
          </li>
          <li>Usage data: API requests, log events, and basic diagnostics.</li>
        </ul>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">3. How we use information</h2>
        <p>
          We use your information to provide and secure the service, deliver documents for signature,
          produce Certificates of Completion, communicate with you, and meet legal obligations. We do
          not sell your personal information.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">4. Sharing and subprocessors</h2>
        <p>
          We share information with service providers who help us run SwiftSign (for example, hosting,
          storage, and email delivery), under contracts that require them to protect it. We may
          disclose information when required by law. Where we process personal data on your behalf, our{' '}
          <Link href="/legal/dpa" className="text-blue-600 hover:underline">
            Data Processing Addendum
          </Link>{' '}
          governs that processing.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">5. Retention and security</h2>
        <p>
          We retain documents and audit records for as long as your account is active or as needed to
          provide the service and comply with legal obligations. We use industry-standard measures to
          protect your data, though no method of transmission or storage is fully secure.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">6. Your choices</h2>
        <p>
          You can access, correct, or delete account information, and request a copy or deletion of
          your data, subject to legal limits. To exercise these rights, contact us at the address
          below.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">7. Contact</h2>
        <p>
          Privacy questions or requests? Email{' '}
          <a href="mailto:support@swiftsign.ca" className="text-blue-600 hover:underline">
            support@swiftsign.ca
          </a>
          .
        </p>
      </section>
    </main>
  );
}
