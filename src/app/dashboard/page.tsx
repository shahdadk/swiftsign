import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkQuota } from '@/lib/quota';
import { env } from '@/lib/env';
import { InstallCard } from '@/components/landing/install-card';
import { CopyButton } from '@/components/copy-button';
import { ActivityFeed } from './activity-feed';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect('/dashboard/login');

  const [envelopes, quota, apiKeys, activityRows] = await Promise.all([
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
    prisma.auditLog.findMany({
      where: { envelope: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        event: true,
        envelopeId: true,
        actorName: true,
        actorEmail: true,
        createdAt: true,
        envelope: { select: { subject: true } },
      },
    }),
  ]);

  const hintKey = apiKeys.find((k) => k.mode === 'TEST') ?? apiKeys[0];
  const keyHint = hintKey ? `${hintKey.prefix}…` : null;

  const showQuotaBar = quota.limit !== 'unlimited';
  const usagePct = showQuotaBar
    ? Math.min(100, Math.round((quota.used / (quota.limit as number)) * 100))
    : 0;
  const quotaTone = usagePct >= 100 ? 'over' : usagePct >= 80 ? 'warn' : '';

  const counts = {
    pending: envelopes.filter((e) => e.status === 'SENT').length,
    completed: envelopes.filter((e) => e.status === 'COMPLETED').length,
    draft: envelopes.filter((e) => e.status === 'DRAFT').length,
  };

  const initialActivity = activityRows.map((r) => ({
    id: r.id,
    event: r.event,
    envelopeId: r.envelopeId,
    envelopeSubject: r.envelope.subject,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt.toISOString(),
  }));

  // SwiftSign's MCP does anchor-based field detection (finds underscored
  // signature lines or "Signature:" labels in the PDF). Prompts don't have
  // to tell Claude where to place the signature — that's the AI-native value.
  const firstPrompt = `Send mutual-nda.pdf to legal@acme.com for signature.`;

  const curlExample = `curl -X POST ${env.NEXT_PUBLIC_APP_URL}/api/v1/envelopes \\
  -H "Authorization: Bearer ${keyHint ?? 'sk_test_...'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Services Agreement",
    "documents": [{ "name": "contract.pdf", "base64": "<base64-encoded-pdf>" }],
    "recipients": [{ "name": "John Smith", "email": "john@example.com", "role": "SIGNER", "routingOrder": 1 }]
  }'`;

  const hasEnvelopes = envelopes.length > 0;

  return (
    <main className="container" style={{ padding: '28px 0 80px' }}>
      {/* Compact header — operator's email + at-a-glance counts. Not a
          marketing hero; this is a tool the user opens to do work. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <div
            className="mono"
            style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 4 }}
          >
            {user.email}
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--ink)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Envelopes
          </h1>
        </div>
        <div className="dash-stats" style={{ marginTop: 0 }}>
          <Link href="#envelopes">
            <span className="dash-stats-num">{counts.pending}</span>
            <span className="dash-stats-label">pending</span>
          </Link>
          <Link href="#envelopes">
            <span className="dash-stats-num">{counts.completed}</span>
            <span className="dash-stats-label">completed</span>
          </Link>
          <Link href="#envelopes">
            <span className="dash-stats-num">{counts.draft}</span>
            <span className="dash-stats-label">draft</span>
          </Link>
        </div>
      </header>

      {/* Setup pane — prominent ONLY when the account is empty. Once they've
          sent one, this collapses behind a small "Send another" disclosure. */}
      {!hasEnvelopes && (
        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
            padding: 24,
            marginBottom: 32,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-4)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Get started
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0 0 4px',
            }}
          >
            Two steps. About a minute.
          </h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 13.5, marginBottom: 18 }}>
            SwiftSign sends contracts from your terminal via Claude Code (or any MCP-aware
            client). The MCP figures out where the signature goes — no field-dragging.
          </p>

          <div className="dash-setup" style={{ maxWidth: 'none' }}>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--ink-4)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                1 · install the MCP server
              </div>
              <InstallCard />
            </div>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--ink-4)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                2 · say this to Claude Code
              </div>
              <div className="dash-setup-prompt">
                {firstPrompt}
                <span className="copy">
                  <CopyButton value={firstPrompt} variant="inline" label="copy" />
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Envelopes — primary content area when the account has any work. */}
      <section id="envelopes">
        {hasEnvelopes && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              {envelopes.length} total
            </div>
            <details style={{ fontSize: 12 }}>
              <summary
                className="mono"
                style={{
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  listStyle: 'none',
                  fontSize: 12,
                }}
              >
                Send another →
              </summary>
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-md)',
                  maxWidth: 720,
                }}
              >
                <div
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8 }}
                >
                  paste this into Claude Code:
                </div>
                <div className="dash-setup-prompt" style={{ marginBottom: 10 }}>
                  {firstPrompt}
                  <span className="copy">
                    <CopyButton value={firstPrompt} variant="inline" label="copy" />
                  </span>
                </div>
                <details>
                  <summary
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-4)',
                      cursor: 'pointer',
                      listStyle: 'none',
                    }}
                  >
                    or use cURL →
                  </summary>
                  <pre
                    className="dev-card-code mono"
                    style={{ position: 'relative', marginTop: 8, fontSize: 11 }}
                  >
                    <code>{curlExample}</code>
                    <span style={{ position: 'absolute', top: 8, right: 8 }}>
                      <CopyButton value={curlExample} variant="inline" />
                    </span>
                  </pre>
                </details>
              </div>
            </details>
          </div>
        )}

        {envelopes.length === 0 ? (
          <div className="env-empty">
            <div>Your envelopes will show up here.</div>
            <div style={{ marginTop: 6 }}>
              <span>Send one with Claude Code using the prompt above.</span>
            </div>
          </div>
        ) : (
          <div className="env-grid">
            {envelopes.map((envelope) => {
              const signedCount = envelope.recipients.filter((r) => r.status === 'SIGNED').length;
              const signerCount = envelope.recipients.filter((r) => r.role === 'SIGNER').length;
              const isComplete = envelope.status === 'COMPLETED';
              const firstSignedDoc = envelope.documents.find((d) => d.signedKey);
              const statusClass = envelope.status.toLowerCase();

              return (
                <div key={envelope.id} className="env-card">
                  <div className="env-card-head">
                    <Link href={`/dashboard/${envelope.id}`} className="env-card-title">
                      <h3>{envelope.subject}</h3>
                      <p className="env-card-docs">
                        {envelope.documents.map((d) => d.name).join(' · ')}
                      </p>
                    </Link>
                    <span className={`env-status ${statusClass}`}>{statusClass}</span>
                  </div>

                  <div className="env-card-row">
                    <div className="env-card-meta">
                      <span>
                        {signedCount}/{signerCount} signed
                      </span>
                      <span className="sep">·</span>
                      <span>
                        {new Date(envelope.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="env-card-actions">
                      {isComplete && firstSignedDoc && (
                        <a
                          href={`/api/envelopes/${envelope.id}/download`}
                          className="btn-link"
                        >
                          ↓ signed PDF
                        </a>
                      )}
                      {isComplete && (
                        <a
                          href={`/api/envelopes/${envelope.id}/download?certificate=true`}
                          className="btn-link"
                        >
                          ↓ certificate
                        </a>
                      )}
                      <Link
                        href={`/dashboard/${envelope.id}`}
                        className="btn-link btn-link-primary"
                      >
                        open →
                      </Link>
                    </div>
                  </div>

                  {envelope.recipients.length > 0 && (
                    <div className="env-chips">
                      {envelope.recipients.map((r) => {
                        const chipClass =
                          r.status === 'SIGNED'
                            ? 'env-chip env-chip-signed'
                            : r.status === 'DECLINED'
                              ? 'env-chip env-chip-declined'
                              : 'env-chip';
                        return (
                          <span
                            key={r.email}
                            className={chipClass}
                            title={`${r.email} (${r.status.toLowerCase()})`}
                          >
                            {r.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Activity feed — secondary, below envelopes. Compact terminal pane. */}
      <section style={{ marginTop: 40 }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--ink-4)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Recent activity
        </div>
        <ActivityFeed initial={initialActivity} />
      </section>

      {/* Quota — lowest emphasis, only when not unlimited. */}
      {showQuotaBar && (
        <div className="quota-strip">
          <div className="quota-strip-row">
            <span>
              {quota.used} / {quota.limit} envelopes this month
            </span>
            <Link href="/dashboard/billing" style={{ color: 'var(--accent)' }}>
              Upgrade
            </Link>
          </div>
          <div className={`quota-bar ${quotaTone}`}>
            <div style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      )}
    </main>
  );
}
