'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatDistance } from '../lib/format'
import type { NearbyResult, SearchOrigin } from '../types'

const MELBOURNE_CBD: L.LatLngExpression = [-37.8136, 144.9631]

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Popup copy comes from Firestore documents — escape it before injecting HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char)
}

export interface LocatorMapProps {
  origin: SearchOrigin | null
  results: NearbyResult[]
}

/**
 * Leaflet map (OpenStreetMap tiles — no API key, no billing).
 *
 * Loaded with `ssr: false` from LocatorPanel: leaflet touches `window` at
 * import time, so it must never be evaluated during server rendering.
 * Markers are circleMarkers, not the default pin icons, which avoids
 * leaflet's bundler-sensitive marker image URLs entirely.
 */
export function LocatorMap({ origin, results }: LocatorMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  // Initialise once — leaflet owns the container node from here on.
  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      center: MELBOURNE_CBD,
      zoom: 11,
      scrollWheelZoom: false, // the page scrolls; zoom with double-click / +/-
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map)

    mapRef.current = map
    markersRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = null
    }
  }, [])

  // Redraw the origin + result markers, then frame them.
  useEffect(() => {
    const map = mapRef.current
    const markers = markersRef.current
    if (!map || !markers) return

    markers.clearLayers()
    const points: L.LatLngExpression[] = []

    if (origin) {
      points.push([origin.lat, origin.lng])
      L.circleMarker([origin.lat, origin.lng], {
        radius: 8,
        color: '#2563eb',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.9,
      })
        .bindTooltip(origin.label)
        .addTo(markers)
    }

    for (const result of results) {
      points.push([result.lat, result.lng])
      L.circleMarker([result.lat, result.lng], {
        radius: 7,
        color: '#0f766e',
        weight: 2,
        fillColor: '#14b8a6',
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${escapeHtml(result.name)}</strong><br />${escapeHtml(result.address)}<br />${formatDistance(result.distanceMeters)} away`
        )
        .addTo(markers)
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.25), { animate: false })
    }
  }, [origin, results])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of nearby locations"
      className="h-80 w-full rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-800"
    />
  )
}
