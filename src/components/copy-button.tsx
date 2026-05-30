'use client';

import { useState } from 'react';
import { Check, Copy } from '@/components/landing/icons';

/**
 * Generic click-to-copy button. Reuses the same Check/Copy icons + mono font
 * as the landing-page InstallCard, so dashboard surfaces feel continuous
 * with the marketing site rather than generic Tailwind.
 *
 * - `value` is the string copied to clipboard.
 * - `label` is the visible button text (defaults to "copy" / "copied").
 * - `variant="inline"` is a compact version for use next to a single token
 *   (e.g. an API key reveal). Default variant has its own row.
 */
export function CopyButton({
  value,
  label,
  variant = 'default',
  className = '',
}: {
  value: string;
  label?: string;
  variant?: 'default' | 'inline';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const base =
    variant === 'inline'
      ? 'inline-flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-gray-900 transition-colors px-2 py-0.5 rounded border border-gray-200 bg-white'
      : 'inline-flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-gray-900 transition-colors';

  return (
    <button onClick={copy} aria-label="Copy" className={`${base} ${className}`}>
      {copied ? (
        <>
          <Check /> {label ?? 'copied'}
        </>
      ) : (
        <>
          <Copy /> {label ?? 'copy'}
        </>
      )}
    </button>
  );
}
