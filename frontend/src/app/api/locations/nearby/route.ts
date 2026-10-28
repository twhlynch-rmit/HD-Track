import { type NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { nearbyQuerySchema, searchNearby } from '@/features/locator/lib/search'

/**
 * GET /api/locations/nearby?lat=&lng=&radiusKm=&limit=&category=
 *
 * Returns the locations nearest a point, sorted by distance.
 *
 * This is a Next.js Route Handler on the same deployment as the app.
 * Authentication is the same verified session cookie the Server Actions use.
 * The geo work happens on the server so the client cannot ask for an
 * unbounded radius or manufacture the ranking.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'You must be signed in to search.' }, { status: 401 })
  }

  const parsed = nearbyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' },
      { status: 400 }
    )
  }

  try {
    const response = await searchNearby(adminDb.collection('locations'), parsed.data)
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Locator nearby search failed:', error)
    return NextResponse.json(
      { error: 'The Locator search failed — please try again.' },
      { status: 500 }
    )
  }
}
