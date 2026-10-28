import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { collection: vi.fn() } }))

import { GET } from '@/app/api/locations/nearby/route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

const SEARCH_QUERY = 'lat=-37.8136&lng=144.9631&radiusKm=5'

function nearbyRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/locations/nearby?${query}`)
}

function fakeCollection(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const snapshot = {
    size: docs.length,
    docs: docs.map((doc) => ({ id: doc.id, data: () => doc.data })),
  }
  const get = vi.fn().mockResolvedValue(snapshot)
  const where = vi.fn()
  const query = { where, get }
  where.mockReturnValue(query)
  return { collection: { where }, where, get }
}

describe('GET /api/locations/nearby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ uid: 'user-1' } as never)
  })

  it('returns 401 and does no geo work without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(nearbyRequest(SEARCH_QUERY))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'You must be signed in to search.' })
    expect(adminDb.collection).not.toHaveBeenCalled()
  })

  it.each([
    ['missing latitude', 'lng=144.9631&radiusKm=5'],
    ['latitude out of range', 'lat=91&lng=144.9631'],
    ['longitude out of range', 'lat=-37.8136&lng=200'],
    ['zero radius', 'lat=-37.8136&lng=144.9631&radiusKm=0'],
    ['radius over the 500 km cap', 'lat=-37.8136&lng=144.9631&radiusKm=1000'],
    ['limit over the 50 cap', `${SEARCH_QUERY}&limit=100`],
    ['unknown category', `${SEARCH_QUERY}&category=spaceship`],
  ])('returns 400 for %s', async (_label, query) => {
    const response = await GET(nearbyRequest(query))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: expect.any(String) })
    expect(adminDb.collection).not.toHaveBeenCalled()
  })

  it('returns ranked results for a valid signed-in request', async () => {
    const { collection, where } = fakeCollection([
      {
        id: 'carlton',
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
    ])
    vi.mocked(adminDb.collection).mockReturnValue(collection as never)

    const response = await GET(nearbyRequest(`${SEARCH_QUERY}&category=pickup`))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(where).toHaveBeenCalledTimes(2)
    expect(await response.json()).toMatchObject({
      results: [{ id: 'carlton', name: 'Carlton Pickup Point', category: 'pickup' }],
      search: { radiusKm: 5, category: 'pickup', candidates: 2, returned: 1 },
    })
  })

  it('returns 500 when the Firestore query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const where = vi.fn()
    const query = { where, get: vi.fn().mockRejectedValue(new Error('boom')) }
    where.mockReturnValue(query)
    vi.mocked(adminDb.collection).mockReturnValue(query as never)

    const response = await GET(nearbyRequest(SEARCH_QUERY))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'The Locator search failed — please try again.',
    })
    errorSpy.mockRestore()
  })
})
