import 'server-only'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'

export const SESSION_COOKIE_NAME = '__session'

/**
 * Verify the current session cookie and return the decoded token.
 *
 * Shared by Server Components, Server Actions and Route Handlers. The cookie
 * is verified cryptographically with the Admin SDK — the proxy's cheap
 * "is a cookie present?" check is only an optimistic gate.
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) return null

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true)
  } catch {
    return null
  }
}
