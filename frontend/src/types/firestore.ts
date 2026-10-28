import type { Timestamp } from 'firebase/firestore'

/**
 * Firestore collection type definitions.
 *
 * Keep in sync with:
 *   - src/lib/firebase/firestore.ts  (typed collection exports)
 *   - firebase/firestore.rules       (security rules)
 *   - docs/FIRESTORE-SCHEMA.md       (schema documentation)
 *
 * When adding a new collection, use the /firebase-collection skill.
 */

export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  role: 'user'
  createdAt: Timestamp
  updatedAt: Timestamp
  _schemaVersion: 1
}

export type CreateUserProfileInput = Omit<UserProfile, 'createdAt' | 'updatedAt'>

/**
 * Location categories for the Locator feature — keep in sync with:
 *   - frontend/src/features/locator/constants.ts (LOCATION_CATEGORIES)
 *   - backend/scripts/seed-locations.js
 */
export type LocationCategory = 'pickup' | 'service' | 'depot' | 'partner'

/**
 * A place the Locator can find. Reference data: written only by server-side
 * tooling (the seed script uses the Admin SDK) and read only by the nearby
 * Route Handler with the Admin SDK — there is no client accessor.
 * `geohash` is what makes the server-side geo range query possible.
 */
export interface LocationSite {
  id: string
  name: string
  category: LocationCategory
  address: string
  lat: number
  lng: number
  geohash: string
  active: boolean
  createdBy: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  _schemaVersion: 1
}

/**
 * A visit a user logged against a location (owner-only).
 * `locationName` is denormalised at write time so the visitor's list renders
 * without a second read per row.
 */
export interface LocationVisit {
  id: string
  uid: string
  locationId: string
  locationName: string
  visitedAt: Timestamp
  createdAt: Timestamp
  _schemaVersion: 1
}
