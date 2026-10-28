import { collection, doc, type CollectionReference, type DocumentData } from 'firebase/firestore'
import { getClientDb } from './client'
import type { LocationVisit, UserProfile } from '@/types/firestore'

/**
 * Creates a typed Firestore collection reference.
 * Use this factory to add new collections — see docs/FIRESTORE-SCHEMA.md
 */
function typedCollection<T extends DocumentData>(path: string): CollectionReference<T> {
  return collection(getClientDb(), path) as CollectionReference<T>
}

// ── Collections ──────────────────────────────────────────────────────────────
// Add one export per Firestore collection. Keep in sync with:
//   - src/types/firestore.ts
//   - firebase/firestore.rules
//   - docs/FIRESTORE-SCHEMA.md

export function getUsersCollection() {
  return typedCollection<UserProfile>('users')
}

export function userDoc(uid: string) {
  return doc(getUsersCollection(), uid)
}

/**
 * Locator feature — visits logged by a user (owner-only).
 *
 * `locations` deliberately has no client accessor: it is server-owned
 * reference data, read only by the Admin SDK inside the nearby Route Handler.
 * See firebase/firestore.rules.
 */
export function getVisitsCollection() {
  return typedCollection<LocationVisit>('visits')
}
