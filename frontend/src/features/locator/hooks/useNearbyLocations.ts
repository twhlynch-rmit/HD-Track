'use client'

import { useCallback, useRef, useState } from 'react'
import type { LocationCategory } from '@/types/firestore'
import { DEFAULT_RADIUS_KM, DEMO_ORIGIN } from '../constants'
import { fetchNearbyLocations } from '../lib/api'
import { geolocationErrorMessage } from '../lib/format'
import type { LocatorStatus, NearbyResult, SearchOrigin } from '../types'

export interface UseNearbyLocationsResult {
  origin: SearchOrigin | null
  radiusKm: number
  category: LocationCategory | undefined
  results: NearbyResult[]
  status: LocatorStatus
  error: string | null
  locate: () => void
  useDemoOrigin: () => void
  setRadiusKm: (km: number) => void
  setCategory: (category: LocationCategory | undefined) => void
  retry: () => void
}

/**
 * Owns everything about a nearby search: where searches are centred, the
 * radius/category filters, and the request lifecycle (idle → locating /
 * loading → success / error).
 *
 * Searches are started from event handlers (pick a point, change a filter,
 * retry) rather than from an effect watching state — the handler knows which
 * values the new search should use, including the filter values that were
 * current when a geolocation reply arrived.
 */
export function useNearbyLocations(): UseNearbyLocationsResult {
  const [origin, setOrigin] = useState<SearchOrigin | null>(null)
  const [radiusKm, setRadius] = useState<number>(DEFAULT_RADIUS_KM)
  const [category, setCategoryState] = useState<LocationCategory | undefined>(undefined)
  const [results, setResults] = useState<NearbyResult[]>([])
  const [status, setStatus] = useState<LocatorStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Only the latest search may write state — changing a filter while a
  // request is in flight must never show the older response.
  const requestIdRef = useRef(0)

  const runSearch = useCallback(
    (
      nextOrigin: SearchOrigin,
      nextRadiusKm: number,
      nextCategory: LocationCategory | undefined
    ) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      setStatus('loading')
      setError(null)

      fetchNearbyLocations({
        lat: nextOrigin.lat,
        lng: nextOrigin.lng,
        radiusKm: nextRadiusKm,
        category: nextCategory,
      })
        .then((response) => {
          if (requestId !== requestIdRef.current) return
          setResults(response.results)
          setStatus('success')
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return
          setResults([])
          setError(err instanceof Error ? err.message : 'Something went wrong while searching.')
          setStatus('error')
        })
    },
    []
  )

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error')
      setError(
        'This browser does not support location access — use the demo starting point instead.'
      )
      return
    }

    setStatus('locating')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextOrigin: SearchOrigin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Your location',
        }
        setOrigin(nextOrigin)
        runSearch(nextOrigin, radiusKm, category)
      },
      (geoError) => {
        setStatus('error')
        setError(geolocationErrorMessage(geoError.code))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }, [radiusKm, category, runSearch])

  const useDemoOrigin = useCallback(() => {
    const nextOrigin: SearchOrigin = { ...DEMO_ORIGIN }
    setOrigin(nextOrigin)
    runSearch(nextOrigin, radiusKm, category)
  }, [radiusKm, category, runSearch])

  const setRadiusKm = useCallback(
    (km: number) => {
      setRadius(km)
      if (origin) runSearch(origin, km, category)
    },
    [origin, category, runSearch]
  )

  const setCategory = useCallback(
    (nextCategory: LocationCategory | undefined) => {
      setCategoryState(nextCategory)
      if (origin) runSearch(origin, radiusKm, nextCategory)
    },
    [origin, radiusKm, runSearch]
  )

  const retry = useCallback(() => {
    // A failed geolocation has no origin yet — retry the geolocation call
    // itself; otherwise re-run the search that failed.
    if (origin) runSearch(origin, radiusKm, category)
    else locate()
  }, [origin, radiusKm, category, runSearch, locate])

  return {
    origin,
    radiusKm,
    category,
    results,
    status,
    error,
    locate,
    useDemoOrigin,
    setRadiusKm,
    setCategory,
    retry,
  }
}
