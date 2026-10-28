import type { CollectionReference } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { LocationCategory } from '@/types/firestore'
import { LOCATION_CATEGORIES } from '../constants'
import type { NearbyResponse, NearbyResult, NearbySearchParams } from '../types'
import { boundingBox, geohashRangeForBox, haversineMeters, precisionForRadius } from './geo'

/**
 * Validates the query string of GET /api/locations/nearby.
 *
 * These are the caps that keep a search bounded: the client cannot ask for
 * an unbounded radius or a result page larger than 50. Defaults match the
 * UI's behaviour when a parameter is omitted.
 */
export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(500).default(10),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(LOCATION_CATEGORIES).optional(),
})

/** A raw `locations` document narrowed to the fields the search needs. */
interface Candidate {
  id: string
  name: string
  category: LocationCategory
  address: string
  lat: number
  lng: number
  active: boolean
}

function isLocationCategory(value: unknown): value is LocationCategory {
  return typeof value === 'string' && (LOCATION_CATEGORIES as readonly string[]).includes(value)
}

/**
 * Narrow a raw Firestore document to the fields the search needs.
 * Returns null for malformed documents instead of failing the whole search.
 */
function toCandidate(id: string, data: Record<string, unknown>): Candidate | null {
  const { name, category, address, lat, lng, active } = data

  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (typeof name !== 'string' || name.length === 0) return null
  if (!isLocationCategory(category)) return null

  return {
    id,
    name,
    category,
    address: typeof address === 'string' ? address : '',
    lat,
    lng,
    // `active === false` retires a location; a missing flag counts as active.
    active: active !== false,
  }
}

/**
 * Find the locations nearest a point, sorted by distance.
 *
 * This runs on the server (Next.js Route Handler), not in the browser:
 * validation, the radius cap and the ranking are all decided here, so a
 * client cannot request an unbounded search or manufacture an order.
 *
 *   query params → validate (zod, in the route) → bounding box
 *   → geohash range query → exact haversine filter → sort → limit
 */
export async function searchNearby(
  locations: CollectionReference,
  params: NearbySearchParams
): Promise<NearbyResponse> {
  const { lat, lng, radiusKm, category, limit = 20 } = params

  // 1. Circle → bounding box → one range query on the geohash field.
  const box = boundingBox(lat, lng, radiusKm)
  const range = geohashRangeForBox(box, precisionForRadius(radiusKm))

  const snapshot = await locations
    .where('geohash', '>=', range.min)
    .where('geohash', '<=', range.max)
    .get()

  // 2. Exact refinement — the range query only guarantees a superset.
  const maxDistanceMeters = radiusKm * 1000
  const results = snapshot.docs
    .map((doc) => toCandidate(doc.id, doc.data()))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .filter((candidate) => candidate.active)
    .filter((candidate) => category === undefined || candidate.category === category)
    .map((candidate): NearbyResult => ({
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
      distanceMeters: haversineMeters(lat, lng, candidate.lat, candidate.lng),
    }))
    .filter((candidate) => candidate.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit)

  return {
    results,
    search: {
      lat,
      lng,
      radiusKm,
      category: category ?? null,
      candidates: snapshot.size,
      returned: results.length,
    },
  }
}
