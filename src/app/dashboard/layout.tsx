import { getSession } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard-nav'
import { billingEnabled } from '@/lib/env'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    // /dashboard/login and /dashboard/verify render unauthenticated.
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        userEmail={user.email}
        userPlan={user.plan}
        billingEnabled={billingEnabled}
      />
      {children}
    </div>
  )
}
