'use client'

import type { LocationCategory } from '@/types/firestore'
import { CATEGORY_OPTIONS, RADIUS_OPTIONS_KM, isLocationCategory } from '../constants'
import type { LocatorStatus, SearchOrigin } from '../types'

interface LocatorControlsProps {
  status: LocatorStatus
  origin: SearchOrigin | null
  radiusKm: number
  category: LocationCategory | undefined
  onLocate: () => void
  onUseDemoOrigin: () => void
  onRadiusChange: (km: number) => void
  onCategoryChange: (category: LocationCategory | undefined) => void
  onRetry: () => void
}

const primaryButton =
  'rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

const secondaryButton =
  'rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800'

const select =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Where to search from, how far, and in what category.
 * Announced to assistive tech as a labelled control region so the three
 * states of "searching" (idle / locating / retryable error) are readable
 * without seeing the results panel.
 */
export function LocatorControls({
  status,
  origin,
  radiusKm,
  category,
  onLocate,
  onUseDemoOrigin,
  onRadiusChange,
  onCategoryChange,
  onRetry,
}: LocatorControlsProps) {
  const searchBusy = status === 'locating' || status === 'loading'

  return (
    <section
      aria-label="Search controls"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onLocate} disabled={searchBusy} className={primaryButton}>
          {status === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
        <button
          type="button"
          onClick={onUseDemoOrigin}
          disabled={searchBusy}
          className={secondaryButton}
        >
          Use demo point
        </button>
        <span className="text-sm text-zinc-500" aria-live="polite">
          {origin ? `Searching from ${origin.label}` : 'No starting point chosen yet'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label htmlFor="locator-radius" className="text-sm font-medium">
            Radius
          </label>
          <select
            id="locator-radius"
            value={radiusKm}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
            className={select}
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="locator-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="locator-category"
            value={category ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onCategoryChange(isLocationCategory(value) ? value : undefined)
            }}
            className={select}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {status === 'error' && origin && (
          <button type="button" onClick={onRetry} className={secondaryButton}>
            Retry search
          </button>
        )}
      </div>
    </section>
  )
}
