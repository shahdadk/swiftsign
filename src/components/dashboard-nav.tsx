'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/landing/icons'

type NavItem = { href: string; label: string }

// Primary nav. Webhooks intentionally removed — they live under
// /dashboard/settings → Advanced for the rare developer-user who builds
// automation around SwiftSign event callbacks. Most operators never need
// to think about them.
const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Envelopes' },
  { href: '/dashboard/settings', label: 'API key' },
]

export function DashboardNav({
  userEmail,
  userPlan,
  billingEnabled,
}: {
  userEmail: string
  userPlan: string
  billingEnabled: boolean
}) {
  const pathname = usePathname()
  const items: NavItem[] = billingEnabled
    ? [baseItems[0], baseItems[1], { href: '/dashboard/billing', label: 'Billing' }]
    : baseItems

  return (
    <header className="nav nav-scrolled" style={{ position: 'relative' }}>
      <div className="nav-inner">
        <Link href="/dashboard" className="nav-logo">
          <Logo size={22} />
          <span className="mono">swiftsign</span>
        </Link>

        <nav className="nav-links">
          {items.map((it) => {
            const active =
              it.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                className={'nav-link' + (active ? ' active' : '')}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 6,
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  transition: 'color 120ms, background 120ms',
                }}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        <div
          className="nav-cta"
          style={{ marginLeft: 'auto', alignItems: 'center', gap: 12 }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: billingEnabled ? 'var(--surface-2)' : 'var(--accent-soft)',
              color: billingEnabled ? 'var(--ink-3)' : 'var(--accent)',
              letterSpacing: '0.02em',
            }}
          >
            {billingEnabled ? userPlan.toLowerCase() : 'beta'}
          </span>
          <span
            className="mono nav-dim"
            style={{ fontSize: 12 }}
          >
            <span className="hidden-sm">{userEmail}</span>
          </span>
          <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
            <button
              type="submit"
              className="mono"
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--ink-4)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
