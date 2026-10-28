import type { LocationCategory } from '@/types/firestore'
import type { SearchOrigin } from './types'

/**
 * Fallback search point for when the browser denies or can't provide
 * geolocation (a reviewer on a desktop, or a page served over plain HTTP).
 * Demo data is seeded around this point — see backend/scripts/seed-locations.js.
 */
export const DEMO_ORIGIN: SearchOrigin = {
  lat: -37.8136,
  lng: 144.9631,
  label: 'Melbourne CBD (demo point)',
}

export const DEFAULT_RADIUS_KM = 5

export const RADIUS_OPTIONS_KM = [1, 5, 10, 25, 50] as const

/**
 * Categories the nearby endpoint accepts. Kept as a runtime tuple (not just
 * the TypeScript union) so the request schema can enumerate them.
 */
export const LOCATION_CATEGORIES = [
  'pickup',
  'service',
  'depot',
  'partner',
] as const satisfies readonly LocationCategory[]

export const CATEGORY_OPTIONS: ReadonlyArray<{ value: LocationCategory | ''; label: string }> = [
  { value: '', label: 'All categories' },
  { value: 'pickup', label: 'Pickup point' },
  { value: 'service', label: 'Service centre' },
  { value: 'depot', label: 'Depot' },
  { value: 'partner', label: 'Partner site' },
]

/** Narrow an untrusted string (e.g. a <select> value) to a category. */
export function isLocationCategory(value: string): value is LocationCategory {
  return value === 'pickup' || value === 'service' || value === 'depot' || value === 'partner'
}
