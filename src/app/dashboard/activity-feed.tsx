'use client';

import { useEffect, useState } from 'react';

type ActivityEvent = {
  id: string;
  event: string;
  envelopeId: string;
  envelopeSubject: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 5_000;

/**
 * Live activity feed. Polls /api/dashboard/activity every 5s and renders
 * audit-log rows as terminal-style lines, reusing the landing page's .term-*
 * classes so the dashboard reads as the same product.
 *
 * Hydrates from `initial` (server-side fetched) to avoid first-paint flicker.
 */
export function ActivityFeed({ initial }: { initial: ActivityEvent[] }) {
  const [events, setEvents] = useState<ActivityEvent[]>(initial);
  const [now, setNow] = useState<number>(() => Date.now());

  // Poll for new events. Stop polling when the tab is hidden so we don't
  // hammer the API while the user isn't looking; resume on visibility.
  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch('/api/dashboard/activity', { cache: 'no-store' });
        if (!res.ok) return;
        const data: { events: ActivityEvent[] } = await res.json();
        if (!cancelled) setEvents(data.events);
      } catch {
        // network blip — keep the existing rows on screen
      }
    }

    let id = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    function onVis() {
      window.clearInterval(id);
      if (!document.hidden) {
        fetchOnce();
        id = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Tick a clock every 30s so the relative timestamps re-render without
  // refetching the events list.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="activity-feed">
      <div className="term-wrap">
        <div className="term-chrome">
          <div className="term-lights">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <span className="term-title mono">
            <span className="term-path">swiftsign</span>
            <span>·</span>
            <span>live</span>
          </span>
          <span className="term-spacer" />
          <span className="term-model mono">polling 5s</span>
        </div>
        <div className="term-body">
          {events.length === 0 ? (
            <div className="activity-empty"># waiting for your first envelope event…</div>
          ) : (
            events.map((e) => (
              <ActivityRow key={e.id} event={e} now={now} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ event, now }: { event: ActivityEvent; now: number }) {
  const ageMs = now - new Date(event.createdAt).getTime();
  const time = formatRelative(ageMs);
  const { icon, iconClass, line } = renderLine(event);

  return (
    <div className="activity-row">
      <span className={`activity-icon ${iconClass}`}>{icon}</span>
      <span className="activity-text">{line}</span>
      <span className="activity-time">{time}</span>
    </div>
  );
}

function renderLine(e: ActivityEvent): {
  icon: string;
  iconClass: string;
  line: React.ReactNode;
} {
  const who = e.actorName || e.actorEmail || 'someone';
  const subject = e.envelopeSubject;

  switch (e.event) {
    case 'ENVELOPE_CREATED':
      return { icon: '+', iconClass: 'sent', line: `created envelope “${subject}”` };
    case 'ENVELOPE_SENT':
      return { icon: '→', iconClass: 'sent', line: `sent envelope “${subject}”` };
    case 'DOCUMENT_VIEWED':
      return { icon: '👁', iconClass: 'viewed', line: `${who} opened “${subject}”` };
    case 'ESIGN_CONSENT_ACCEPTED':
      return { icon: '✓', iconClass: 'viewed', line: `${who} accepted ESIGN consent on “${subject}”` };
    case 'FIELD_COMPLETED':
      return { icon: '·', iconClass: 'viewed', line: `${who} filled a field on “${subject}”` };
    case 'RECIPIENT_SIGNED':
      return { icon: '✓', iconClass: 'signed', line: `${who} signed “${subject}”` };
    case 'ENVELOPE_COMPLETED':
      return { icon: '✓', iconClass: 'completed', line: `“${subject}” is sealed` };
    case 'ENVELOPE_DECLINED':
      return { icon: '✗', iconClass: 'declined', line: `${who} declined “${subject}”` };
    case 'ENVELOPE_VOIDED':
      return { icon: '⊘', iconClass: 'voided', line: `voided “${subject}”` };
    case 'EMAIL_SENT':
      return { icon: '✉', iconClass: 'sent', line: `email sent for “${subject}”` };
    case 'EMAIL_BOUNCED':
      return { icon: '!', iconClass: 'declined', line: `email bounced for “${subject}”` };
    default:
      return { icon: '·', iconClass: 'viewed', line: `${e.event.toLowerCase().replace(/_/g, ' ')} — “${subject}”` };
  }
}

function formatRelative(ageMs: number): string {
  if (ageMs < 0) return 'just now';
  const sec = Math.floor(ageMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(Date.now() - ageMs).toLocaleDateString();
}
