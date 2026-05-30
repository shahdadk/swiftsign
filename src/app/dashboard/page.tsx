import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkQuota } from '@/lib/quota';
import { env } from '@/lib/env';
import { InstallCard } from '@/components/landing/install-card';
import { CopyButton } from '@/components/copy-button';

// Status pill colors. Match the landing page's understated palette rather
// than fighting it with bright Tailwind defaults.
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  SENT: 'bg-blue-50 text-blue-700 border-blue-100',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  DECLINED: 'bg-red-50 text-red-700 border-red-100',
  VOIDED: 'bg-amber-50 text-amber-700 border-amber-100',
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

  // Display-only key hint. Secrets are never stored in plaintext; the prefix
  // is enough to identify which key is in flight from another shell.
  const hintKey = apiKeys.find((k) => k.mode === 'TEST') ?? apiKeys[0];
  const keyHint = hintKey ? `${hintKey.prefix}…` : null;

  const showQuotaBar = quota.limit !== 'unlimited';
  const usagePct = showQuotaBar
    ? Math.min(100, Math.round((quota.used / (quota.limit as number)) * 100))
    : 0;

  // Counts for the hero summary row.
  const counts = {
    pending: envelopes.filter((e) => e.status === 'SENT').length,
    completed: envelopes.filter((e) => e.status === 'COMPLETED').length,
    draft: envelopes.filter((e) => e.status === 'DRAFT').length,
  };

  // Pre-build the curl example so the CopyButton can drop the full string in
  // one click rather than the user fighting whitespace from a <pre>.
  const curlExample = `curl -X POST ${env.NEXT_PUBLIC_APP_URL}/api/v1/envelopes \\
  -H "Authorization: Bearer ${keyHint ?? 'sk_test_...'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Services Agreement",
    "documents": [{ "name": "contract.pdf", "base64": "<base64-encoded-pdf>" }],
    "recipients": [{ "name": "John Smith", "email": "john@example.com", "role": "SIGNER", "routingOrder": 1 }],
    "fields": [{ "recipientIndex": 0, "type": "SIGNATURE", "document": 0, "page": 1, "x": 15, "y": 85, "width": 30, "height": 5 }]
  }'`;

  return (
    <main>
      {/* Hero — npx install front and center, mirrors the landing page so
          the dashboard feels like the same product, not a separate admin app. */}
      <section className="hero" style={{ padding: '64px 0 40px' }}>
        <div className="dotgrid" />
        <div className="blob blob-a" style={{ top: '-200px', left: '-120px' }} />
        <div className="blob blob-b" style={{ top: '-80px', right: '-160px' }} />

        <div className="container hero-inner" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
          <div className="kicker">
            <span className="dot" />
            <span>Signed in as {user.email}</span>
          </div>

          <h1 className="hero-h1" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
            Send contracts
            <br />
            <span className="hero-accent">from your terminal.</span>
          </h1>

          <div className="hero-install" style={{ width: '100%', maxWidth: 720 }}>
            <InstallCard />
          </div>

          {/* At-a-glance counts. Quick visual answer to "how many envelopes
              are pending in my account" without a deep dive. */}
          <div
            className="hero-trust mono"
            style={{ marginTop: 24, display: 'flex', gap: 28, flexWrap: 'wrap' }}
          >
            <Link href="#envelopes" style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600 }}>{counts.pending}</span> pending
            </Link>
            <span className="sep">·</span>
            <Link href="#envelopes" style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600 }}>{counts.completed}</span> completed
            </Link>
            <span className="sep">·</span>
            <Link href="#envelopes" style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600 }}>{counts.draft}</span> draft
            </Link>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: 80 }}>
        {/* API key reveal — single-click copy, no manual selection. */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--line)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="eyebrow" style={{ marginBottom: 4 }}>
                API key
              </p>
              {keyHint ? (
                <p className="mono text-sm" style={{ color: 'var(--ink-2)' }}>
                  {keyHint}{' '}
                  <Link href="/dashboard/settings" style={{ color: 'var(--accent)' }}>
                    reveal full key →
                  </Link>
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                  No keys yet —{' '}
                  <Link href="/dashboard/settings" style={{ color: 'var(--accent)' }}>
                    create one in Settings →
                  </Link>
                </p>
              )}
            </div>
            {keyHint && <CopyButton value={keyHint} variant="inline" label="copy prefix" />}
          </div>
        </div>

        {/* Curl quickstart — also has a copy button so users don't have to
            scrub triple-clicks across a multiline <pre>. */}
        <div
          className="rounded-2xl p-5 mb-8"
          style={{ background: 'var(--ink)', color: '#e8eaed' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow mono" style={{ color: '#8a9099' }}>
              Send an envelope via cURL
            </p>
            <CopyButton
              value={curlExample}
              className="text-gray-300 hover:text-white"
              label="copy"
            />
          </div>
          <pre
            className="mono text-xs"
            style={{
              overflowX: 'auto',
              whiteSpace: 'pre',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {curlExample}
          </pre>
        </div>

        {/* Quota bar — minimal, doesn't fight for attention with the hero. */}
        {showQuotaBar && (
          <div
            className="rounded-2xl p-4 mb-8"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm mono" style={{ color: 'var(--ink-2)' }}>
                {quota.used} / {quota.limit} envelopes this month
              </p>
              <Link
                href="/dashboard/billing"
                className="text-sm"
                style={{ color: 'var(--accent)' }}
              >
                Upgrade
              </Link>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--line)' }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${usagePct}%`,
                  background:
                    usagePct >= 100
                      ? '#ef4444'
                      : usagePct >= 80
                        ? '#f59e0b'
                        : 'var(--accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Envelopes list. Each row is its own clickable card; download +
            recipient detail land on the right so the action is visible
            without entering the detail page. */}
        <section id="envelopes">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              Envelopes
            </h2>
            <span className="mono text-xs" style={{ color: 'var(--ink-4)' }}>
              {envelopes.length} total
            </span>
          </div>

          {envelopes.length === 0 ? (
            <div
              className="rounded-2xl text-center py-12"
              style={{
                border: '1px dashed var(--line)',
                color: 'var(--ink-4)',
              }}
            >
              <p className="mono text-sm">No envelopes yet.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
                Send your first one with the cURL example above, or via the MCP server.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {envelopes.map((envelope) => {
                const signedCount = envelope.recipients.filter((r) => r.status === 'SIGNED').length;
                const signerCount = envelope.recipients.filter((r) => r.role === 'SIGNER').length;
                const isComplete = envelope.status === 'COMPLETED';
                const firstSignedDoc = envelope.documents.find((d) => d.signedKey);

                return (
                  <div
                    key={envelope.id}
                    className="rounded-2xl p-5 transition-all"
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <Link
                        href={`/dashboard/${envelope.id}`}
                        className="flex-1 min-w-0"
                        style={{ color: 'inherit' }}
                      >
                        <h3 className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          {envelope.subject}
                        </h3>
                        <p
                          className="mono text-xs truncate mt-1"
                          style={{ color: 'var(--ink-4)' }}
                        >
                          {envelope.documents.map((d) => d.name).join(' · ')}
                        </p>
                      </Link>
                      <span
                        className={`mono text-xs font-medium px-2.5 py-1 rounded-full border ${
                          STATUS_STYLES[envelope.status] || STATUS_STYLES.DRAFT
                        }`}
                        style={{ flexShrink: 0 }}
                      >
                        {envelope.status.toLowerCase()}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between gap-4 flex-wrap"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mono text-xs">
                        <span>
                          {signedCount}/{signerCount} signed
                        </span>
                        <span style={{ color: 'var(--ink-4)' }}>·</span>
                        <span style={{ color: 'var(--ink-4)' }}>
                          {new Date(envelope.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Download is visible only for completed envelopes —
                            sealed PDFs don't exist before that. */}
                        {isComplete && firstSignedDoc && (
                          <a
                            href={`/api/envelopes/${envelope.id}/download`}
                            className="mono text-xs px-3 py-1.5 rounded-lg border transition-colors"
                            style={{
                              borderColor: 'var(--line)',
                              color: 'var(--ink-2)',
                              background: '#ffffff',
                            }}
                          >
                            ↓ signed PDF
                          </a>
                        )}
                        {isComplete && (
                          <a
                            href={`/api/envelopes/${envelope.id}/download?certificate=true`}
                            className="mono text-xs px-3 py-1.5 rounded-lg border transition-colors"
                            style={{
                              borderColor: 'var(--line)',
                              color: 'var(--ink-2)',
                              background: '#ffffff',
                            }}
                          >
                            ↓ certificate
                          </a>
                        )}
                        <Link
                          href={`/dashboard/${envelope.id}`}
                          className="mono text-xs px-3 py-1.5 rounded-lg"
                          style={{ color: 'var(--accent)' }}
                        >
                          open →
                        </Link>
                      </div>
                    </div>

                    {/* Recipient chips. Names only, signed status visible via color. */}
                    {envelope.recipients.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {envelope.recipients.map((r) => (
                          <span
                            key={r.email}
                            className="mono text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                r.status === 'SIGNED'
                                  ? 'rgba(16, 185, 129, 0.08)'
                                  : r.status === 'DECLINED'
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'rgba(0,0,0,0.04)',
                              color:
                                r.status === 'SIGNED'
                                  ? '#047857'
                                  : r.status === 'DECLINED'
                                    ? '#b91c1c'
                                    : 'var(--ink-3)',
                            }}
                            title={`${r.email} — ${r.status.toLowerCase()}`}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
