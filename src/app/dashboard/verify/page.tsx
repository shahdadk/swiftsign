import Link from 'next/link';
import { Logo } from '@/components/landing/icons';

export default function VerifyPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 96,
      }}
    >
      <div className="dotgrid" />
      <div className="blob blob-a" style={{ top: '-200px', left: '-120px' }} />
      <div className="blob blob-b" style={{ top: '-80px', right: '-160px' }} />

      <Link
        href="/"
        className="nav-logo"
        style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}
      >
        <Logo size={28} />
        <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
          swiftsign
        </span>
      </Link>

      <div
        className="install-card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 28,
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--success)', marginBottom: 12 }}>
          Check your email
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
          Link sent.
        </h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          A sign-in link is on the way. Click it to access your dashboard. The link expires in 15
          minutes.
        </p>
        <p
          className="mono"
          style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 18 }}
        >
          # didn&apos;t arrive? check your spam folder, or{' '}
          <Link href="/dashboard/login" style={{ color: 'var(--accent)' }}>
            try again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
