'use client';

import { useState } from 'react';
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
      const res = await fetch('/api/auth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError('Failed to send sign-in link. Try again.');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8 text-gray-900">
          <Logo size={32} />
          <h1 className="text-2xl font-bold">SwiftSign</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {sent ? (
            <>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 text-center">
                If <strong>{email}</strong> is on the beta allowlist, a sign-in link is on its way.
                Otherwise{' '}
                <a
                  href="mailto:hello@swiftsign.ca?subject=SwiftSign%20beta%20access"
                  className="text-blue-600 hover:underline"
                >
                  request access
                </a>
                .
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in to SwiftSign</h2>
              <p className="text-sm text-gray-500 mb-6">
                Private beta — only invited emails can sign in.{' '}
                <a
                  href="mailto:hello@swiftsign.ca?subject=SwiftSign%20beta%20access"
                  className="text-blue-600 hover:underline"
                >
                  Request access
                </a>
                .
              </p>

              <form onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                  required
                />

                {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send sign-in link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
