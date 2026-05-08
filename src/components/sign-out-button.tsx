'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/dashboard/login' })}
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      Sign out
    </button>
  )
}
