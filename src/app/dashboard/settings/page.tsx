import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ApiKeyCard } from './api-key-card'
import { SessionsCard } from './sessions-card'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSession()
  if (!user) redirect('/dashboard/login')

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Account, API key, and session management.
      </p>

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Account</h2>
        <p className="text-sm text-gray-500 mb-3">{user.email}</p>
      </section>

      <ApiKeyCard initialKey={user.apiKey ?? ''} />

      <SessionsCard />
    </main>
  )
}
