import type { LocationCategory } from '@/types/firestore'

/** Query the Locator API sends for a nearby search. */
export interface NearbySearchParams {
  lat: number
  lng: number
  radiusKm: number
  category?: LocationCategory
  limit?: number
}

/** One search hit, already ranked and distance-sorted by the API. */
export interface NearbyResult {
  id: string
  name: string
  category: LocationCategory
  address: string
  lat: number
  lng: number
  distanceMeters: number
}

/** Echo of the search parameters plus how many documents were considered. */
export interface NearbySearchMeta {
  lat: number
  lng: number
  radiusKm: number
  category: LocationCategory | null
  candidates: number
  returned: number
}

export interface NearbyResponse {
  results: NearbyResult[]
  search: NearbySearchMeta
}

/** The point searches are centred on (the user, or the demo fallback). */
export interface SearchOrigin {
  lat: number
  lng: number
  label: string
}

/**
 * Every state the Locator screen can be in:
 * idle    — no origin yet, nothing has been asked for
 * locating— waiting on the browser's geolocation API
 * loading — waiting on the Locator API
 * error   — geolocation or the API failed; message explains which
 * success — results are on screen
 */
export type LocatorStatus = 'idle' | 'locating' | 'loading' | 'error' | 'success'
