'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/landing/icons'

type NavItem = { href: string; label: string }

const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Envelopes' },
  { href: '/dashboard/settings', label: 'API key' },
  { href: '/dashboard/webhooks', label: 'Webhooks' },
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
    ? [
        baseItems[0],
        baseItems[1],
        { href: '/dashboard/billing', label: 'Billing' },
        baseItems[2],
      ]
    : baseItems
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-900">
          <Logo size={22} />
          <span className="font-semibold text-sm">SwiftSign</span>
        </Link>

        <nav className="flex items-center gap-1 ml-4">
          {items.map((it) => {
            const active =
              it.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {billingEnabled ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {userPlan}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Beta
            </span>
          )}
          <span className="text-sm text-gray-500 hidden sm:inline">
            {userEmail}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
