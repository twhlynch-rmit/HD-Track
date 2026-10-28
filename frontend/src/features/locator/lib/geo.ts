/**
 * Geospatial helpers for the Locator feature's "find nearby" search.
 *
 * Everything in this file is pure (no Firestore, no I/O) so it can be unit
 * tested directly — see frontend/tests/unit/features/locator/lib/geo.test.ts.
 *
 * Why geohash: Firestore has no native "points within X km of here" query.
 * It can, however, range-query a single string field. So every `locations`
 * document stores a geohash of its coordinates, and a search becomes:
 *
 *   1. circle around the origin  →  bounding box
 *   2. bounding box             →  the geohash cells it touches  →  one
 *      range query (geohash >= min && geohash <= max)
 *   3. the range query returns a SUPERSET of the candidates (z-order proof
 *      below), which the route then refines exactly with haversine distance
 *
 * The superset property matters: for an axis-aligned box, every cell the box
 * touches has cell-column >= the SW corner's column and cell-row >= the SW
 * corner's row (and symmetrically <= the NE corner's). In the z-order that
 * geohash uses, a cell whose column and row are both >= another cell's is
 * never ordered before it — so `encode(SW) .. encode(NE)` cannot miss a cell
 * the box touches. It can include extra cells (the "staircase" between the
 * two corners); those are discarded by the exact distance check afterwards.
 */

/** Base32 alphabet used by geohash — already in ascending sort order. */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Mean Earth radius in metres (IUGG). */
const EARTH_RADIUS_M = 6_371_008.8

/** Kilometres per degree of latitude on this sphere (= πR/180). */
const KM_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180 / 1000

/** Safety margin so floating-point/ellipsoid drift never clips the circle. */
const BBOX_MARGIN = 1.02

export interface BoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface GeohashRange {
  min: string
  max: string
}

/**
 * Encode a latitude/longitude pair as a geohash of the requested precision.
 * Standard implementation: bisect lat/lng alternately (lng first), taking 5
 * bits at a time and mapping them through the base32 alphabet.
 */
export function encodeGeohash(lat: number, lng: number, precision: number): string {
  let minLat = -90
  let maxLat = 90
  let minLng = -180
  let maxLng = 180

  let hash = ''
  let bit = 0
  let current = 0
  let isLngBit = true

  while (hash.length < precision) {
    if (isLngBit) {
      const mid = (minLng + maxLng) / 2
      if (lng >= mid) {
        current = (current << 1) + 1
        minLng = mid
      } else {
        current = current << 1
        maxLng = mid
      }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) {
        current = (current << 1) + 1
        minLat = mid
      } else {
        current = current << 1
        maxLat = mid
      }
    }

    isLngBit = !isLngBit
    bit += 1

    if (bit === 5) {
      hash += BASE32[current] ?? ''
      bit = 0
      current = 0
    }
  }

  return hash
}

/**
 * Latitude/longitude bounding box that fully contains a circle of
 * `radiusKm` around (lat, lng).
 *
 * Longitude degrees shrink with latitude, so the lng delta is divided by
 * cos(lat). Latitude is clamped to ±90°; longitude is clamped to ±180° —
 * a search circle that crosses the antimeridian is clipped (documented
 * limitation: this app targets a single metro area).
 */
export function boundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latDelta = (radiusKm * BBOX_MARGIN) / KM_PER_DEGREE
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const lngDelta = (radiusKm * BBOX_MARGIN) / (KM_PER_DEGREE * Math.max(Math.abs(cosLat), 0.01))

  const minLat = Math.max(-90, lat - latDelta)
  const maxLat = Math.min(90, lat + latDelta)
  const minLng = Math.max(-180, lng - lngDelta)
  const maxLng = Math.min(180, lng + lngDelta)

  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Pick the geohash precision whose cells are roughly the same size as the
 * search circle — coarse enough that the [SW, NE] range does not drag in a
 * huge staircase of irrelevant cells, fine enough to prune hard.
 *
 * Approximate cell sizes (lat × lng): p6 ≈ 0.6 × 1.2 km, p5 ≈ 2.4 × 4.9 km,
 * p4 ≈ 19.5 × 39 km, p3 ≈ 78 × 156 km, p2 ≈ 313 × 625 km.
 */
export function precisionForRadius(radiusKm: number): number {
  if (radiusKm <= 1.25) return 6
  if (radiusKm <= 5) return 5
  if (radiusKm <= 20) return 4
  if (radiusKm <= 75) return 3
  return 2
}

/**
 * The single geohash range covering every cell a bounding box touches.
 * Returns the hashes of the SW and NE corners at `precision`; because
 * geohash strings sort in cell order, a string range query between them is
 * a superset of the box (see the file header for why no cell is missed).
 */
export function geohashRangeForBox(box: BoundingBox, precision: number): GeohashRange {
  const min = encodeGeohash(box.minLat, box.minLng, precision)
  const max = encodeGeohash(box.maxLat, box.maxLng, precision)
  return { min, max }
}

/**
 * Great-circle distance between two coordinates, in metres.
 */
export function haversineMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(toLat - fromLat)
  const dLng = toRad(toLng - fromLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}
