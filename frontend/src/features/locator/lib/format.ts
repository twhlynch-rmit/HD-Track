import type { LocationCategory } from '@/types/firestore'
import { CATEGORY_OPTIONS } from '../constants'

/** Label for a category, shared by the filter and the result list. */
export function categoryLabel(category: LocationCategory): string {
  const match = CATEGORY_OPTIONS.find((option) => option.value === category)
  return match ? match.label : category
}

/** Metres → "840 m" below a kilometre, "2.4 km" above it. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Browser geolocation error codes → copy that tells the user what to do next. */
export function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission was denied — allow it in your browser, or use the demo starting point.'
    case 2: // POSITION_UNAVAILABLE
      return 'Your position is unavailable right now — try again, or use the demo starting point.'
    case 3: // TIMEOUT
      return 'Timed out waiting for your location — try again, or use the demo starting point.'
    default:
      return 'Could not determine your location — try again, or use the demo starting point.'
  }
}
