'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/landing/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Round-trip a validated post-login destination (e.g. the OAuth consent
      // screen) through the magic link.
      const next = new URLSearchParams(window.location.search).get('next');
      const res = await fetch('/api/auth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(next ? { next } : {}) }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to send sign-in link. Try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

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
        style={{ width: '100%', maxWidth: 420, padding: 28, position: 'relative', zIndex: 1 }}
      >
        {sent ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
              Link sent.
            </h2>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 4 }}>
              We sent a sign-in link to{' '}
              <span className="mono" style={{ color: 'var(--ink)' }}>
                {email}
              </span>
              . Click it to continue. The link expires in 15 minutes.
            </p>
            <p
              style={{ color: 'var(--ink-4)', fontSize: 12.5, marginTop: 16 }}
            >
              Didn&apos;t arrive? Check spam, or{' '}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError('');
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--accent)',
                  font: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                try a different email
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
              Get a magic link.
            </h2>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 22 }}>
              Enter your email. We&apos;ll send you a sign-in link. No password.
            </p>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="login-email"
                className="mono"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  letterSpacing: '0.02em',
                }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="mono"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 14,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  marginBottom: 14,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                }}
              />

              {error && (
                <p
                  className="mono"
                  style={{ fontSize: 12, color: '#b91c1c', marginBottom: 12 }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: loading || !email ? 0.6 : 1 }}
              >
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>

            <p
              style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 16, textAlign: 'center' }}
            >
              By continuing you agree to our{' '}
              <Link href="/legal/terms" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </div>

      <p
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-4)',
          marginTop: 24,
          position: 'relative',
          zIndex: 1,
        }}
      >
        private beta · invite only
      </p>
    </div>
  );
}
