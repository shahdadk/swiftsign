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
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        <div className="nav-cta" style={{ marginLeft: 'auto' }}>
          <span className={'nav-plan' + (billingEnabled ? '' : ' beta')}>
            {billingEnabled ? userPlan.toLowerCase() : 'beta'}
          </span>
          <span className="nav-email">{userEmail}</span>
          <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
            <button type="submit" className="nav-signout">
              sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
