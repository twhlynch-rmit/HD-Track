'use client'

import { MapPin, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { LocationCategory } from '@/types/firestore'
import { categoryLabel, formatDistance } from '../lib/format'
import type { LocatorStatus, NearbyResult, SearchOrigin } from '../types'

interface NearbyListProps {
  origin: SearchOrigin | null
  status: LocatorStatus
  error: string | null
  results: NearbyResult[]
  radiusKm: number
  category: LocationCategory | undefined
  savingLocationId: string | null
  nextRadiusKm: number | null
  onSaveVisit: (result: NearbyResult) => void
  onRetry: () => void
  onIncreaseRadius: () => void
  onClearCategory: () => void
}

const primaryButton =
  'rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

const secondaryButton =
  'rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800'

const smallButton =
  'rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

function LoadingPanel({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white py-12 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      role="status"
    >
      <LoadingSpinner size="sm" />
      {label}
    </div>
  )
}

function SkeletonPanel() {
  return (
    <div
      role="status"
      aria-label="Loading nearby locations"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="h-4 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      <ul className="mt-4 space-y-3">
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3.5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-56 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The results panel — one branch per state of the search, so empty, loading,
 * error and success are all reachable and all explain what to do next.
 */
export function NearbyList({
  origin,
  status,
  error,
  results,
  radiusKm,
  category,
  savingLocationId,
  nextRadiusKm,
  onSaveVisit,
  onRetry,
  onIncreaseRadius,
  onClearCategory,
}: NearbyListProps) {
  if (!origin) {
    return (
      <EmptyState
        icon={MapPin}
        title="Choose a starting point"
        description="Use your location — or the demo starting point — to find what is nearby."
      />
    )
  }

  if (status === 'locating') {
    return <LoadingPanel label="Getting your location…" />
  }

  if (status === 'loading') {
    return <SkeletonPanel />
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
      >
        <div className="flex items-start gap-2">
          <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">
            {error ?? 'Something went wrong while searching.'}
          </p>
        </div>
        <button type="button" onClick={onRetry} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  }

  if (status === 'success' && results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={`No locations within ${radiusKm} km`}
        description={
          category
            ? 'Nothing matched here. Widen the radius, or clear the category filter.'
            : 'Nothing matched here. Widen the radius and try again.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {nextRadiusKm !== null && (
              <button type="button" onClick={onIncreaseRadius} className={primaryButton}>
                Search {nextRadiusKm} km instead
              </button>
            )}
            {category && (
              <button type="button" onClick={onClearCategory} className={secondaryButton}>
                Clear category filter
              </button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {results.length} location{results.length === 1 ? '' : 's'} within {radiusKm} km
          {category ? ` · ${categoryLabel(category)}` : ''}
        </p>
        <p className="text-xs text-zinc-500">Nearest first</p>
      </div>

      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {results.map((result) => {
          const isSaving = savingLocationId === result.id
          return (
            <li key={result.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{result.name}</p>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {categoryLabel(result.category)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{result.address}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {formatDistance(result.distanceMeters)}
                </span>
                <button
                  type="button"
                  onClick={() => onSaveVisit(result)}
                  disabled={savingLocationId !== null}
                  className={smallButton}
                >
                  {isSaving ? 'Saving…' : 'Log visit'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
