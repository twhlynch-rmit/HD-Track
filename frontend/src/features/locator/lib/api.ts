import type { NearbyResponse, NearbySearchParams } from '../types'

/** Thrown for every failure mode of the nearby search — message is user-facing. */
export class LocatorApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'LocatorApiError'
    this.status = status
  }
}

/** Same-origin Route Handler — see frontend/src/app/api/locations/nearby/route.ts. */
const NEARBY_PATH = '/api/locations/nearby'

function isNearbyResponse(data: unknown): data is NearbyResponse {
  if (typeof data !== 'object' || data === null) return false
  return Array.isArray((data as { results?: unknown }).results)
}

/**
 * Ask the server for the locations nearest a point.
 *
 * The request is same-origin, so the session cookie is sent automatically and
 * there is no CORS or API base URL to configure. The Route Handler verifies
 * the cookie before any geo work happens.
 */
export async function fetchNearbyLocations(params: NearbySearchParams): Promise<NearbyResponse> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm),
    limit: String(params.limit ?? 20),
  })
  if (params.category) query.set('category', params.category)

  let response: Response
  try {
    response = await fetch(`${NEARBY_PATH}?${query.toString()}`, { cache: 'no-store' })
  } catch {
    throw new LocatorApiError('Could not reach the Locator — check your connection and try again.')
  }

  if (response.status === 401) {
    throw new LocatorApiError('Your session has expired — sign in again to search.', 401)
  }

  if (!response.ok) {
    let detail = `The Locator responded with status ${response.status}.`
    try {
      const problem = (await response.json()) as { error?: unknown }
      if (typeof problem.error === 'string' && problem.error.length > 0) {
        detail = problem.error
      }
    } catch {
      // Non-JSON error body — keep the generic status message.
    }
    throw new LocatorApiError(detail, response.status)
  }

  const data: unknown = await response.json().catch(() => null)
  if (!isNearbyResponse(data)) {
    throw new LocatorApiError('The Locator returned an unexpected response.', response.status)
  }

  return data
}
