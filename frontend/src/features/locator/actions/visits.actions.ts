'use server'

import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { requireAuth } from '@/actions/auth.actions'
import { adminDb } from '@/lib/firebase/admin'
import type { ActionResult } from '@/types'

const logVisitSchema = z.object({
  locationId: z.string().min(1, 'Location is required').max(128),
})

/**
 * Log a visit against a location for the signed-in user.
 *
 * The location is re-read server-side rather than trusting a name from the
 * browser: the visit must point at a real, currently-active location, and
 * the display name shown in the visitor's list comes from the source of
 * truth. Firestore rules still deny cross-user reads on `visits`.
 */
export async function logVisit(input: unknown): Promise<ActionResult<string>> {
  const session = await requireAuth()

  const parsed = logVisitSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const locationSnap = await adminDb.collection('locations').doc(parsed.data.locationId).get()

    if (!locationSnap.exists) {
      return { success: false, error: 'That location no longer exists.' }
    }

    const location = locationSnap.data()
    if (!location || location.active === false) {
      return { success: false, error: 'That location is no longer active.' }
    }

    const now = Timestamp.now()
    const visitRef = await adminDb.collection('visits').add({
      uid: session.uid,
      locationId: parsed.data.locationId,
      locationName: typeof location.name === 'string' ? location.name : 'Unnamed location',
      visitedAt: now,
      createdAt: now,
      _schemaVersion: 1,
    })

    return { success: true, data: visitRef.id }
  } catch {
    return { success: false, error: 'Failed to log visit — please try again.' }
  }
}
