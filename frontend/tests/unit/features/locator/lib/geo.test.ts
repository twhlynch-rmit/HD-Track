import { describe, it, expect } from 'vitest'
import {
  boundingBox,
  encodeGeohash,
  geohashRangeForBox,
  haversineMeters,
  precisionForRadius,
} from '@/features/locator/lib/geo'

describe('encodeGeohash', () => {
  it('matches the reference geohash for (42.605, -5.603)', () => {
    expect(encodeGeohash(42.605, -5.603, 5)).toBe('ezs42')
  })

  it('matches the reference geohash for (57.64911, 10.40744)', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
  })

  it('is a prefix-stable truncation at lower precision', () => {
    expect(encodeGeohash(42.605, -5.603, 3)).toBe('ezs')
  })

  it('emits only base32 geohash characters', () => {
    expect(encodeGeohash(-37.8136, 144.9631, 9)).toMatch(/^[0123456789bcdefghjkmnpqrstuvwxyz]{9}$/)
  })
})

describe('boundingBox', () => {
  it('covers one degree of latitude in every direction', () => {
    const lat = -37.8136
    const lng = 144.9631
    const box = boundingBox(lat, lng, 5)
    const latDeltaDegrees = 5 / ((6_371_008.8 * Math.PI) / 180 / 1000)

    expect(box.minLat).toBeLessThan(lat - latDeltaDegrees)
    expect(box.maxLat).toBeGreaterThan(lat + latDeltaDegrees)
    expect(box.minLng).toBeLessThan(lng)
    expect(box.maxLng).toBeGreaterThan(lng)
  })

  it('widens longitude further from the equator', () => {
    const equator = boundingBox(0, 144.9631, 5)
    const melbourne = boundingBox(-37.8136, 144.9631, 5)

    const equatorWidth = equator.maxLng - equator.minLng
    const melbourneWidth = melbourne.maxLng - melbourne.minLng
    expect(melbourneWidth).toBeGreaterThan(equatorWidth)
  })

  it('clamps to valid coordinate limits', () => {
    const box = boundingBox(89.9, 179.9, 500)

    expect(box.maxLat).toBeLessThanOrEqual(90)
    expect(box.minLat).toBeGreaterThanOrEqual(-90)
    expect(box.maxLng).toBeLessThanOrEqual(180)
    expect(box.minLng).toBeGreaterThanOrEqual(-180)
  })
})

describe('precisionForRadius', () => {
  it('uses finer cells for smaller searches', () => {
    expect(precisionForRadius(1)).toBe(6)
    expect(precisionForRadius(5)).toBe(5)
    expect(precisionForRadius(20)).toBe(4)
    expect(precisionForRadius(75)).toBe(3)
    expect(precisionForRadius(500)).toBe(2)
  })
})

describe('geohashRangeForBox', () => {
  it('produces an ordered range at the requested precision', () => {
    const box = boundingBox(-37.81, 144.96, 10)
    const range = geohashRangeForBox(box, 4)

    expect(range.min).toHaveLength(4)
    expect(range.max).toHaveLength(4)
    expect(range.min <= range.max).toBe(true)
  })

  it('contains every cell the bounding box touches (no false negatives)', () => {
    const box = boundingBox(-37.81, 144.96, 10)
    const precision = precisionForRadius(10)
    const range = geohashRangeForBox(box, precision)

    const steps = 12
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const lat = box.minLat + ((box.maxLat - box.minLat) * i) / steps
        const lng = box.minLng + ((box.maxLng - box.minLng) * j) / steps
        const hash = encodeGeohash(lat, lng, precision)

        expect(hash >= range.min && hash <= range.max).toBe(true)
      }
    }
  })
})

describe('haversineMeters', () => {
  it('is zero for a point with itself', () => {
    expect(haversineMeters(-37.8136, 144.9631, -37.8136, 144.9631)).toBe(0)
  })

  it('is symmetric', () => {
    const forward = haversineMeters(-37.8136, 144.9631, -38.7, 144.9)
    const backward = haversineMeters(-38.7, 144.9, -37.8136, 144.9631)

    expect(forward).toBeCloseTo(backward, 6)
  })

  it('matches one degree of latitude along the meridian', () => {
    const oneDegree = haversineMeters(0, 0, 1, 0)
    const expected = (6_371_008.8 * Math.PI) / 180

    expect(Math.abs(oneDegree - expected)).toBeLessThan(1)
  })

  it('matches one degree of longitude at the equator', () => {
    const oneDegree = haversineMeters(0, 0, 0, 1)
    const expected = (6_371_008.8 * Math.PI) / 180

    expect(Math.abs(oneDegree - expected)).toBeLessThan(1)
  })

  it('shrinks with latitude for the same longitude span', () => {
    const equator = haversineMeters(0, 0, 0, 1)
    const melbourne = haversineMeters(-37.8136, 144.9631, -37.8136, 145.9631)

    expect(melbourne).toBeLessThan(equator)
  })
})
