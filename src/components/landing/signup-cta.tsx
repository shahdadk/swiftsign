"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "./icons";

/**
 * Self-serve sandbox-key widget. Replaces the old "Request access" mailto gate.
 * One click -> email -> POST /api/v1/signup -> an sk_test_ key on the spot,
 * the same instant-key path /docs already advertises.
 */
export function SignupCta({ label = "Get a free test key" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "site" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error?.message ?? data?.detail ?? data?.error ?? "Could not create a key. Try again."
        );
      }
      setApiKey(data.api_key ?? data.apiKey ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a key. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard?.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (apiKey) {
    return (
      <div className="signup-result">
        <div className="signup-result-label mono">Your sandbox key — free + unlimited</div>
        <button className="signup-key mono" onClick={copyKey} aria-label="Copy API key">
          <code>{apiKey}</code>
          <span className="signup-key-copy">
            {copied ? (
              <>
                <Check /> copied
              </>
            ) : (
              <>
                <Copy /> copy
              </>
            )}
          </span>
        </button>
        <p className="signup-next mono">
          Set <code>SWIFTSIGN_API_KEY</code> and your agent can send.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn btn-accent" onClick={() => setOpen(true)}>
        {label} <ArrowRight />
      </button>
    );
  }

  return (
    <form className="signup-form" onSubmit={submit}>
      <input
        type="email"
        required
        autoFocus
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="signup-input mono"
        disabled={loading}
        aria-label="Email for your sandbox key"
      />
      <button type="submit" className="btn btn-accent" disabled={loading}>
        {loading ? (
          "Creating…"
        ) : (
          <>
            Get key <ArrowRight />
          </>
        )}
      </button>
      {error && (
        <p className="signup-error mono" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
