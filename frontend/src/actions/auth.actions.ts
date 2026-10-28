'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import type { ActionResult } from '@/types'

/**
 * Require authentication in a Server Action or Server Component.
 * Redirects to /login if not authenticated.
 */
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    redirect('/auth/signin')
  }
  return session
}

/**
 * Server-side sign out: clears the session cookie.
 */
export async function serverSignOut(): Promise<ActionResult> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to sign out' }
  }
}
