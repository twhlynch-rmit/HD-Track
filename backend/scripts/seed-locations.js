#!/usr/bin/env node
/**
 * Seeds the `locations` collection the Locator feature searches.
 *
 * Coordinates are written with a geohash.
 *
 * The field the Locator's nearby Route Handler range query runs on.
 * Document IDs are stable slugs, so re-running the script updates
 * the same documents instead of duplicating them.
 *
 * Firestore security rules block client writes to `locations`. This script
 * talks to Firestore with the Admin SDK, which bypasses those rules.
 *
 * Run from the repo root (needs .env):
 *   pnpm --filter backend seed:locations
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

/** Geohash alphabet must match frontend/src/features/locator/lib/geo.ts */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const GEOHASH_PRECISION = 9

/** Encode a lat/lng pair into a geohash string of the given precision */
function encodeGeohash(lat, lng, precision) {
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
      hash += BASE32[current] || ''
      bit = 0
      current = 0
    }
  }

  return hash
}

/** Minimal .env parser. Same rules as scripts/sync-env.js. */
function parseEnv(content) {
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Demo dataset - Melbourne metro.
 * Replace names/addresses/categories with the client's real sites; the
 * coordinates only need to be plausible, since distance is computed from them.
 */
const LOCATIONS = [
  {
    name: 'Melbourne CBD Pickup Point',
    category: 'pickup',
    address: '250 Flinders St, Melbourne',
    lat: -37.8136,
    lng: 144.9631,
  },
  {
    name: 'Docklands Service Centre',
    category: 'service',
    address: '18 Harbour Esplanade, Docklands',
    lat: -37.815,
    lng: 144.946,
  },
  {
    name: 'Southbank Depot',
    category: 'depot',
    address: '60 City Rd, Southbank',
    lat: -37.825,
    lng: 144.965,
  },
  {
    name: 'Carlton Pickup Point',
    category: 'pickup',
    address: '214 Elgin St, Carlton',
    lat: -37.8,
    lng: 144.967,
  },
  {
    name: 'Fitzroy Partner Site',
    category: 'partner',
    address: '240 Brunswick St, Fitzroy',
    lat: -37.798,
    lng: 144.978,
  },
  {
    name: 'Richmond Service Centre',
    category: 'service',
    address: '430 Swan St, Richmond',
    lat: -37.818,
    lng: 145.0,
  },
  {
    name: 'Brunswick Depot',
    category: 'depot',
    address: '105 Sydney Rd, Brunswick',
    lat: -37.767,
    lng: 144.96,
  },
  {
    name: 'Coburg Pickup Point',
    category: 'pickup',
    address: '87 Bell St, Coburg',
    lat: -37.745,
    lng: 144.967,
  },
  {
    name: 'Preston Depot',
    category: 'depot',
    address: '12 High St, Preston',
    lat: -37.773,
    lng: 145.0,
  },
  {
    name: 'Northcote Partner Site',
    category: 'partner',
    address: '110 Separation St, Northcote',
    lat: -37.77,
    lng: 144.997,
  },
  {
    name: 'Hawthorn Service Centre',
    category: 'service',
    address: '620 Burwood Rd, Hawthorn',
    lat: -37.822,
    lng: 145.02,
  },
  {
    name: 'Kew Partner Site',
    category: 'partner',
    address: '1 King St, Kew',
    lat: -37.805,
    lng: 145.03,
  },
  {
    name: 'Camberwell Pickup Point',
    category: 'pickup',
    address: '714 Burke Rd, Camberwell',
    lat: -37.826,
    lng: 145.056,
  },
  {
    name: 'Footscray Depot',
    category: 'depot',
    address: '25 Barkly St, Footscray',
    lat: -37.8,
    lng: 144.9,
  },
  {
    name: 'Yarraville Partner Site',
    category: 'partner',
    address: '1 Sims St, Yarraville',
    lat: -37.817,
    lng: 144.89,
  },
  {
    name: 'Essendon Service Centre',
    category: 'service',
    address: '100 Mount Alexander Rd, Essendon',
    lat: -37.75,
    lng: 144.92,
  },
  {
    name: 'Ascot Vale Pickup Point',
    category: 'pickup',
    address: '40 Union Rd, Ascot Vale',
    lat: -37.783,
    lng: 144.92,
  },
  {
    name: 'Moonee Ponds Depot',
    category: 'depot',
    address: '16 Puckle St, Moonee Ponds',
    lat: -37.766,
    lng: 144.92,
  },
  {
    name: 'St Kilda Service Centre',
    category: 'service',
    address: '240 Fitzroy St, St Kilda',
    lat: -37.868,
    lng: 144.98,
  },
  {
    name: 'Balaclava Partner Site',
    category: 'partner',
    address: '294 Carlisle St, Balaclava',
    lat: -37.857,
    lng: 144.987,
  },
  {
    name: 'Caulfield Depot',
    category: 'depot',
    address: '1 Koornang Rd, Caulfield',
    lat: -37.88,
    lng: 145.02,
  },
  {
    name: 'Malvern Pickup Point',
    category: 'pickup',
    address: '120 Glenferrie Rd, Malvern',
    lat: -37.856,
    lng: 145.02,
  },
  {
    name: 'Prahran Service Centre',
    category: 'service',
    address: '160 Chapel St, Prahran',
    lat: -37.852,
    lng: 144.992,
  },
  {
    name: 'Altona Partner Site',
    category: 'partner',
    address: '1 Civic Rd, Altona',
    lat: -37.868,
    lng: 144.83,
  },
  {
    name: 'Port Melbourne Depot',
    category: 'depot',
    address: '54 Beach St, Port Melbourne',
    lat: -37.832,
    lng: 144.94,
    active: false,
  },
]

async function main() {
  const root = path.resolve(__dirname, '..', '..')
  const envPath = path.join(root, '.env')

  if (!fs.existsSync(envPath)) {
    console.error('No .env found at the repo root. Copy .env.example to .env and fill it in first.')
    process.exit(1)
  }

  const env = parseEnv(fs.readFileSync(envPath, 'utf8'))
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 || ''

  if (!projectId || projectId.startsWith('REPLACE_WITH')) {
    console.error('Set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env before seeding.')
    process.exit(1)
  }
  if (!serviceAccountKey) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 in .env before seeding.')
    process.exit(1)
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'))),
          projectId,
        })

  const db = getFirestore(app)
  const batch = db.batch()
  const now = FieldValue.serverTimestamp()

  for (const location of LOCATIONS) {
    const ref = db.collection('locations').doc(slugify(location.name))
    batch.set(
      ref,
      {
        name: location.name,
        category: location.category,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        geohash: encodeGeohash(location.lat, location.lng, GEOHASH_PRECISION),
        active: location.active !== false,
        createdBy: 'seed-script',
        createdAt: now,
        updatedAt: now,
        _schemaVersion: 1,
      },
      { merge: true }
    )
  }

  await batch.commit()

  const activeCount = LOCATIONS.filter((location) => location.active !== false).length
  console.log(`Seeded ${LOCATIONS.length} locations into '${projectId}'`)
  console.log(`  active: ${activeCount} · retired: ${LOCATIONS.length - activeCount}`)
  console.log('Document IDs are stable slugs. Re-running updates in place.')
  console.log('Next: sign in, open /locator, and search from the demo point.')
}

main().catch((err) => {
  console.error('Seeding failed:', err.message)
  process.exit(1)
})
