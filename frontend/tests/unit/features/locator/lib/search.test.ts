import { describe, it, expect, vi } from 'vitest'
import type { CollectionReference } from 'firebase-admin/firestore'
import { nearbyQuerySchema, searchNearby } from '@/features/locator/lib/search'
import { precisionForRadius } from '@/features/locator/lib/geo'
import type { NearbySearchParams } from '@/features/locator/types'

/** Melbourne CBD — the search origin used across these tests. */
const ORIGIN = { lat: -37.8136, lng: 144.9631 }

interface FakeDoc {
  id: string
  data: Record<string, unknown>
}

/** Stub the Firestore geohash range query so no real Firebase call happens. */
function fakeLocations(docs: FakeDoc[]) {
  const snapshot = {
    size: docs.length,
    docs: docs.map((doc) => ({ id: doc.id, data: () => doc.data })),
  }
  const get = vi.fn().mockResolvedValue(snapshot)
  const where = vi.fn()
  // .where().where().get() — the chain must return itself at every step.
  const query = { where, get }
  where.mockReturnValue(query)
  return { collection: { where } as unknown as CollectionReference, where, get }
}

/** Every document the fixture range query returns, before geo filtering. */
const FIXTURE_DOCS: FakeDoc[] = [
  {
    id: 'nearby-north',
    data: {
      name: 'Carlton Pickup Point',
      category: 'pickup',
      address: '210 Elgin St, Carlton',
      lat: -37.805,
      lng: 144.9631,
      active: true,
    },
  },
  {
    id: 'nearby-south',
    data: {
      name: 'Southbank Service Centre',
      category: 'service',
      address: 'Freshwater Place, Southbank',
      lat: -37.84,
      lng: 144.9631,
      active: true,
    },
  },
  {
    id: 'retired',
    data: {
      name: 'Retired Depot',
      category: 'depot',
      address: 'Somewhere nearby',
      lat: -37.814,
      lng: 144.964,
      active: false,
    },
  },
  {
    id: 'malformed',
    data: { name: 'No coordinates', category: 'pickup', address: '—' },
  },
  {
    id: 'unknown-category',
    data: {
      name: 'Spaceport',
      category: 'spaceship',
      address: 'Somewhere nearby',
      lat: -37.814,
      lng: 144.964,
      active: true,
    },
  },
  {
    id: 'far-away',
    data: {
      name: 'Remote Partner Site',
      category: 'partner',
      address: 'Nowhere near',
      lat: 0,
      lng: 0,
      active: true,
    },
  },
]

const PARAMS: NearbySearchParams = { ...ORIGIN, radiusKm: 5 }

describe('nearbyQuerySchema', () => {
  it.each([
    ['missing latitude', { lng: '144.9631', radiusKm: '5' }],
    ['non-numeric latitude', { lat: 'abc', lng: '144.9631' }],
    ['latitude out of range', { lat: '91', lng: '144.9631' }],
    ['longitude out of range', { lat: '-37.8136', lng: '200' }],
    ['zero radius', { lat: '-37.8136', lng: '144.9631', radiusKm: '0' }],
    ['radius over the 500 km cap', { lat: '-37.8136', lng: '144.9631', radiusKm: '1000' }],
    ['limit over the 50 cap', { lat: '-37.8136', lng: '144.9631', limit: '100' }],
    ['unknown category', { lat: '-37.8136', lng: '144.9631', category: 'spaceship' }],
  ])('rejects %s', (_label, query) => {
    expect(nearbyQuerySchema.safeParse(query).success).toBe(false)
  })

  it('coerces query strings and applies the documented defaults', () => {
    const parsed = nearbyQuerySchema.parse({ lat: '-37.8136', lng: '144.9631' })

    expect(parsed).toEqual({
      lat: -37.8136,
      lng: 144.9631,
      radiusKm: 10,
      limit: 20,
    })
  })
})

describe('searchNearby', () => {
  it('queries the geohash field with a range at the radius-derived precision', async () => {
    const { collection, where } = fakeLocations([])

    await searchNearby(collection, PARAMS)

    expect(where).toHaveBeenCalledTimes(2)
    expect(where).toHaveBeenNthCalledWith(1, 'geohash', '>=', expect.any(String))
    expect(where).toHaveBeenNthCalledWith(2, 'geohash', '<=', expect.any(String))

    const minHash = where.mock.calls[0]?.[2] as string
    expect(minHash).toHaveLength(precisionForRadius(5))
  })

  it('returns only in-radius, active, well-formed locations sorted nearest first', async () => {
    const { collection } = fakeLocations(FIXTURE_DOCS)

    const response = await searchNearby(collection, PARAMS)

    expect(response.results.map((result) => result.id)).toEqual(['nearby-north', 'nearby-south'])

    const [north, south] = response.results
    expect(north!.distanceMeters).toBeGreaterThan(900)
    expect(north!.distanceMeters).toBeLessThan(1000)
    expect(south!.distanceMeters).toBeGreaterThan(north!.distanceMeters)
    expect(south!.distanceMeters).toBeLessThan(3000)

    expect(response.search).toEqual({
      lat: -37.8136,
      lng: 144.9631,
      radiusKm: 5,
      category: null,
      candidates: FIXTURE_DOCS.length,
      returned: 2,
    })
  })

  it('filters by category', async () => {
    const { collection } = fakeLocations(FIXTURE_DOCS)

    const response = await searchNearby(collection, { ...PARAMS, category: 'pickup' })

    expect(response.results.map((result) => result.id)).toEqual(['nearby-north'])
    expect(response.search.category).toBe('pickup')
  })

  it('caps the number of results at limit', async () => {
    const { collection } = fakeLocations(FIXTURE_DOCS)

    const response = await searchNearby(collection, { ...PARAMS, limit: 1 })

    expect(response.results).toHaveLength(1)
    expect(response.results[0]?.id).toBe('nearby-north')
    expect(response.search.returned).toBe(1)
  })

  it('applies a default limit of 20', async () => {
    const manyDocs = Array.from({ length: 25 }, (_, index) => ({
      id: `location-${index}`,
      data: {
        name: `Location ${index}`,
        category: 'pickup',
        address: 'Nearby',
        lat: ORIGIN.lat + index * 0.0001,
        lng: ORIGIN.lng,
        active: true,
      },
    }))
    const { collection } = fakeLocations(manyDocs)

    const response = await searchNearby(collection, PARAMS)

    expect(response.results).toHaveLength(20)
    expect(response.search.candidates).toBe(25)
  })

  it('uses the requested radius to filter candidates', async () => {
    const { collection } = fakeLocations(FIXTURE_DOCS)

    const response = await searchNearby(collection, { ...PARAMS, radiusKm: 1 })

    expect(response.results.map((result) => result.id)).toEqual(['nearby-north'])
  })

  it('defaults a missing address to an empty string', async () => {
    const { collection } = fakeLocations([
      {
        id: 'no-address',
        data: {
          name: 'Unaddressed Pickup Point',
          category: 'pickup',
          lat: -37.814,
          lng: 144.964,
          active: true,
        },
      },
    ])

    const response = await searchNearby(collection, PARAMS)

    expect(response.results[0]?.address).toBe('')
  })

  it('returns an empty result set when nothing is nearby', async () => {
    const { collection } = fakeLocations([])

    const response = await searchNearby(collection, PARAMS)

    expect(response.results).toEqual([])
    expect(response.search).toMatchObject({ candidates: 0, returned: 0 })
  })
})
