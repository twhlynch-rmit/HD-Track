'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { logVisit } from '../actions/visits.actions'
import { RADIUS_OPTIONS_KM } from '../constants'
import { useNearbyLocations } from '../hooks/useNearbyLocations'
import { useVisits } from '../hooks/useVisits'
import type { NearbyResult } from '../types'
import { LocatorControls } from './LocatorControls'
import type { LocatorMapProps } from './LocatorMap'
import { NearbyList } from './NearbyList'
import { VisitsList } from './VisitsList'

/**
 * Leaflet touches `window` on import, so the map is client-only — it must
 * never be evaluated while Next.js renders the page on the server.
 */
const LocatorMap = dynamic<LocatorMapProps>(
  () => import('./LocatorMap').then((module) => ({ default: module.LocatorMap })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-80 w-full animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-800"
      />
    ),
  }
)

/** Live visit history for one user (owner-only query — see firestore.rules). */
function VisitsFeed({ uid }: { uid: string }) {
  const { visits, loading } = useVisits(uid)

  return <VisitsList visits={visits} loading={loading} />
}

/**
 * The Locator screen: search controls, map, ranked results with
 * "log visit", and the user's own visit history.
 *
 * All interactive state lives in useNearbyLocations — this component only
 * wires the pieces together and forwards server-action outcomes as toasts.
 */
export function LocatorPanel() {
  const locator = useNearbyLocations()
  const { user } = useAuth()
  const [savingLocationId, setSavingLocationId] = useState<string | null>(null)

  const nextRadiusKm = useMemo(
    () => RADIUS_OPTIONS_KM.find((km) => km > locator.radiusKm) ?? null,
    [locator.radiusKm]
  )

  const handleSaveVisit = async (result: NearbyResult) => {
    setSavingLocationId(result.id)
    try {
      const outcome = await logVisit({ locationId: result.id })
      if (outcome.success) {
        toast.success(`Visit logged at ${result.name}`)
      } else {
        toast.error(outcome.error ?? 'Failed to log visit.')
      }
    } finally {
      // Runs even if the action redirected (NEXT_REDIRECT) or rejected.
      setSavingLocationId(null)
    }
  }

  const handleIncreaseRadius = () => {
    if (nextRadiusKm !== null) locator.setRadiusKm(nextRadiusKm)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <LocatorControls
          status={locator.status}
          origin={locator.origin}
          radiusKm={locator.radiusKm}
          category={locator.category}
          onLocate={locator.locate}
          onUseDemoOrigin={locator.useDemoOrigin}
          onRadiusChange={locator.setRadiusKm}
          onCategoryChange={locator.setCategory}
          onRetry={locator.retry}
        />

        <LocatorMap origin={locator.origin} results={locator.results} />

        <NearbyList
          origin={locator.origin}
          status={locator.status}
          error={locator.error}
          results={locator.results}
          radiusKm={locator.radiusKm}
          category={locator.category}
          savingLocationId={savingLocationId}
          nextRadiusKm={nextRadiusKm}
          onSaveVisit={handleSaveVisit}
          onRetry={locator.retry}
          onIncreaseRadius={handleIncreaseRadius}
          onClearCategory={() => locator.setCategory(undefined)}
        />
      </div>

      <div className="min-w-0">
        {user ? <VisitsFeed uid={user.uid} /> : <VisitsList visits={[]} loading />}
      </div>
    </div>
  )
}
