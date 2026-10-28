'use client'

import { useMemo } from 'react'
import { where } from 'firebase/firestore'
import { useCollection } from '@/hooks/useFirestore'
import { getVisitsCollection } from '@/lib/firebase/firestore'
import type { LocationVisit } from '@/types/firestore'

interface UseVisitsResult {
  visits: LocationVisit[]
  loading: boolean
}

/**
 * The signed-in user's visits, live-updating (onSnapshot).
 *
 * Two things matter here:
 * - the collection reference is memoised: useCollection re-subscribes
 *   whenever its reference identity changes;
 * - `uid` must be final before this mounts — useCollection applies its
 *   constraints to the first subscription, so mount this only once the
 *   auth state has resolved (LocatorPanel does this).
 *
 * Results are sorted in the UI, not with orderBy, so the owner-only query
 * needs no composite index.
 */
export function useVisits(uid: string): UseVisitsResult {
  const visitsCollection = useMemo(() => getVisitsCollection(), [])
  const { data: visits, loading } = useCollection(visitsCollection, where('uid', '==', uid))

  return { visits, loading }
}
