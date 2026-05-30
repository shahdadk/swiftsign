import Link from 'next/link';

export const metadata = {
  title: 'SwiftSign — Acceptable Use Policy',
};

export default function AcceptableUsePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Acceptable Use Policy</h1>
      <p className="text-sm text-gray-500 mb-10">
        This policy is part of our{' '}
        <Link href="/legal/terms" className="text-blue-600 hover:underline">
          Terms of Service
        </Link>
        .
      </p>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">1. Purpose</h2>
        <p>
          This policy describes uses of SwiftSign that are prohibited. It exists to keep the service
          safe, lawful, and reliable for everyone. Using SwiftSign means you agree to follow it.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">2. Prohibited content and conduct</h2>
        <p>You may not use SwiftSign to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Break the law, infringe intellectual property, or violate the rights of others.</li>
          <li>Send fraudulent, deceptive, or forged documents, or impersonate any person or entity.</li>
          <li>
            Distribute malware, phishing content, or unsolicited bulk messages, or attempt to harvest
            recipient data for unrelated purposes.
          </li>
          <li>
            Transmit content that is unlawful, harassing, defamatory, or otherwise objectionable.
          </li>
          <li>
            Collect or process sensitive data (such as health or payment-card data) without the legal
            basis and safeguards required for it.
          </li>
        </ul>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">3. System integrity</h2>
        <p>You may not:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Probe, scan, or test the vulnerability of the service without authorization.</li>
          <li>Circumvent rate limits, quotas, authentication, or other access controls.</li>
          <li>Interfere with or disrupt the service or the infrastructure that runs it.</li>
          <li>Resell or sublicense the service in a way not permitted by your plan.</li>
        </ul>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">4. Enforcement</h2>
        <p>
          We may investigate suspected violations and may suspend or terminate access, remove content,
          or take other action we consider appropriate. Serious violations may be reported to law
          enforcement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">5. Reporting</h2>
        <p>
          To report abuse or a violation of this policy, email{' '}
          <a href="mailto:support@swiftsign.ca" className="text-blue-600 hover:underline">
            support@swiftsign.ca
          </a>
          .
        </p>
      </section>
    </main>
  );
}
