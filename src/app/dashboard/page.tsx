import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkQuota } from '@/lib/quota';
import { env } from '@/lib/env';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  VOIDED: 'bg-yellow-100 text-yellow-700',
};

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect('/dashboard/login');

  const [envelopes, quota, apiKeys] = await Promise.all([
    prisma.envelope.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        recipients: {
          select: { name: true, email: true, status: true, role: true, signedAt: true },
        },
        documents: {
          select: { name: true, signedKey: true },
        },
      },
    }),
    checkQuota(user.id),
    prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Display-only key hint. Secrets are never stored in plaintext and are only
  // shown once at creation — prefer a test key for the quickstart, else any key.
  const hintKey = apiKeys.find((k) => k.mode === 'TEST') ?? apiKeys[0];
  const keyHint = hintKey ? `${hintKey.prefix}…` : null;

  const showQuotaBar = quota.limit !== 'unlimited';
  const usagePct = showQuotaBar
    ? Math.min(100, Math.round((quota.used / (quota.limit as number)) * 100))
    : 0;

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {showQuotaBar && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900">
                {quota.used} / {quota.limit} envelopes this month
              </p>
              <Link
                href="/dashboard/billing"
                className="text-sm text-blue-600 hover:underline"
              >
                Upgrade
              </Link>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usagePct >= 100
                    ? 'bg-red-500'
                    : usagePct >= 80
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Resets {quota.resetAt.toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <span className="text-sm text-gray-500">{envelopes.length} total</span>
        </div>

        {envelopes.length === 0 ? (
          <div className="space-y-6">
            {/* Quickstart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Quickstart</h3>
              {keyHint ? (
                <p className="text-sm text-gray-500 mb-4">
                  Send your first document for signing from Claude Code or any API client. Your test
                  key starts with{' '}
                  <code className="font-mono text-gray-700 bg-gray-100 rounded px-1 py-0.5">
                    {keyHint}
                  </code>
                  {' — '}
                  <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
                    reveal your full key in Settings
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-sm text-gray-500 mb-4">
                  Send your first document for signing from Claude Code or any API client.{' '}
                  <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
                    Create your first API key in Settings
                  </Link>{' '}
                  to get started.
                </p>
              )}

              <p className="text-xs font-medium text-gray-500 mb-1.5">1. Install the SDK</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto whitespace-pre mb-5">{`npm install swiftsign`}</pre>

              <p className="text-xs font-medium text-gray-500 mb-1.5">2. Send an envelope</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`curl -X POST ${env.NEXT_PUBLIC_APP_URL}/api/v1/envelopes \\
  -H "Authorization: Bearer ${keyHint ?? 'sk_test_...'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Services Agreement",
    "documents": [{
      "name": "contract.pdf",
      "base64": "<base64-encoded-pdf>"
    }],
    "recipients": [{
      "name": "John Smith",
      "email": "john@example.com",
      "role": "SIGNER",
      "routingOrder": 1
    }],
    "fields": [{
      "recipientIndex": 0,
      "type": "SIGNATURE",
      "document": 0,
      "page": 1,
      "x": 15,
      "y": 85,
      "width": 30,
      "height": 5
    }]
  }'`}</pre>
              <p className="text-xs text-gray-400 mt-2">
                Replace the Bearer token with your full test key — reveal it in Settings.
              </p>

              <div className="flex items-center gap-4 mt-4 text-sm">
                <Link href="/docs" className="text-blue-600 hover:underline">
                  Read the docs
                </Link>
                <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
                  {keyHint ? 'Manage API keys' : 'Create an API key'}
                </Link>
              </div>
            </div>

            {/* Empty state */}
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">Your sent documents will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {envelopes.map((envelope) => (
              <Link
                key={envelope.id}
                href={`/dashboard/${envelope.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{envelope.subject}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {envelope.documents.map((d) => d.name).join(', ')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[envelope.status] || 'bg-gray-100 text-gray-700'}`}>
                    {envelope.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{envelope.recipients.length} recipient{envelope.recipients.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{new Date(envelope.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>·</span>
                  <span>
                    {envelope.recipients.filter((r) => r.status === 'SIGNED').length}/{envelope.recipients.filter((r) => r.role === 'SIGNER').length} signed
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  {envelope.recipients.map((r) => (
                    <div
                      key={r.email}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === 'SIGNED' ? 'bg-green-50 text-green-700' :
                        r.status === 'DECLINED' ? 'bg-red-50 text-red-700' :
                        'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {r.name}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
