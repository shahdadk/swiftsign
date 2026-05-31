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

  // Initial server-side payload for the activity feed; client polls from here.
  const initialActivity = activityRows.map((r) => ({
    id: r.id,
    event: r.event,
    envelopeId: r.envelopeId,
    envelopeSubject: r.envelope.subject,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt.toISOString(),
  }));

  // The "send your first contract" chat prompt — the canonical AI-first
  // setup affordance. Shown in Step 2 of the hero pane.
  const firstPrompt = `Send the NDA at ~/contracts/mutual-nda.pdf to legal@acme.com for signature. Put the signature at the bottom of the last page.`;

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
      {/* Hero — matches the landing's hero structure so the two pages
          read as one product. Operator gets a kicker with their email,
          a two-step setup pane, and a counts row. */}
      <section className="hero" style={{ padding: '64px 0 56px' }}>
        <div className="dotgrid" />
        <div className="blob blob-a" style={{ top: '-200px', left: '-120px' }} />
        <div className="blob blob-b" style={{ top: '-80px', right: '-160px' }} />

        <div className="container hero-inner" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
          <div className="kicker">
            <span className="dot" />
            <span>
              Signed in as {user.email} · plan: {user.plan?.toLowerCase() ?? 'free'}
            </span>
          </div>

          <h1 className="hero-h1" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
            Your envelopes,
            <br />
            <span className="hero-accent">from the terminal.</span>
          </h1>

          {/* Two-step setup. The InstallCard handles Step 1's copy button;
              Step 2 (the chat prompt) gets its own dark block + CopyButton. */}
          <div className="dash-setup">
            <div>
              <div className="dash-setup-label">
                <span className="num">1</span> Paste this in your terminal once
              </div>
              <InstallCard />
            </div>
            <div>
              <div className="dash-setup-label">
                <span className="num">2</span> Then say this to Claude Code
              </div>
              <div className="dash-setup-prompt">
                {firstPrompt}
                <span className="copy">
                  <CopyButton value={firstPrompt} variant="inline" label="copy" />
                </span>
              </div>
            </div>
          </div>

          {/* At-a-glance counts. Anchors to #envelopes section below. */}
          <div className="dash-stats">
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
        </div>
      </section>

      <div className="container">
        {/* Live activity feed — the AI-first surface. Renders agent
            tool calls + webhook events as terminal lines, polled 5s. */}
        <section className="dash-section">
          <div className="section-head">
            <div className="eyebrow">Activity</div>
            <h2>Live · your agents at work</h2>
          </div>
          <ActivityFeed initial={initialActivity} />
        </section>

        {/* Quick-action cards — landing's .dev-card pattern. Two cards:
            another Claude Code prompt + the cURL example for developers. */}
        <section className="dash-section">
          <div className="section-head">
            <div className="eyebrow">Send another</div>
            <h2>Two ways to send</h2>
          </div>
          <div className="devgrid-cards">
            <div className="dev-card">
              <div className="dev-card-head">
                <span className="dev-card-icon" aria-hidden>
                  ⌘
                </span>
                <span className="dev-card-kicker mono">Claude Code</span>
              </div>
              <h3>Via chat</h3>
              <pre className="dev-card-code mono" style={{ position: 'relative' }}>
                <code>
                  {`> "Send the renewal MSA at ~/contracts/msa.pdf to billing@vendor.com.
   Signature at the bottom, date next to it."`}
                </code>
                <span style={{ position: 'absolute', top: 12, right: 12 }}>
                  <CopyButton
                    value={`Send the renewal MSA at ~/contracts/msa.pdf to billing@vendor.com. Signature at the bottom, date next to it.`}
                    variant="inline"
                  />
                </span>
              </pre>
            </div>

            <div className="dev-card">
              <div className="dev-card-head">
                <span className="dev-card-icon" aria-hidden>
                  $
                </span>
                <span className="dev-card-kicker mono">cURL</span>
              </div>
              <h3>Via API</h3>
              <pre className="dev-card-code mono" style={{ position: 'relative' }}>
                <code>{curlExample}</code>
                <span style={{ position: 'absolute', top: 12, right: 12 }}>
                  <CopyButton value={curlExample} variant="inline" />
                </span>
              </pre>
            </div>
          </div>
        </section>

        {/* Envelopes section — main data view. Each row is an .env-card. */}
        <section className="dash-section" id="envelopes">
          <div className="section-head">
            <div className="eyebrow">Envelopes</div>
            <h2>{envelopes.length === 0 ? 'Nothing yet' : `${envelopes.length} total`}</h2>
          </div>

          {envelopes.length === 0 ? (
            <div className="env-empty">
              <div># your envelopes will show up here</div>
              <div style={{ marginTop: 6 }}>
                <span>send one with Claude Code using the prompt above.</span>
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
                              title={`${r.email} — ${r.status.toLowerCase()}`}
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

        {/* Quota — lowest emphasis. Only shown if not on unlimited. */}
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

        <div style={{ height: 80 }} />
      </div>
    </main>
  );
}
