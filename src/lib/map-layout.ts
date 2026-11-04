// Build-time layout for the static SVG map. Pure functions, no browser APIs.
// Pins appear only for entries with verified lat/lng. The outline is built for map.json's state.
// x0/y0 are the true spots; x/y are spaced for the whole-state view at full size (scripts/report-nudges.ts).
// On screen, src/lib/map-view.ts groups stamps into callouts and places labels for the current zoom.
import { geoConicConformal } from 'd3-geo'
import citiesData from '@/data/cities.json'
import outline from '@/data/outline.json'
import type { City, Stop } from '@/data/types'
import { computeIsland, islandRect } from '@/lib/island'
import { relax, type Rect, type Work } from '@/lib/map-view'

export type MapPin = {
  id: string
  x0: number
  y0: number
  x: number
  y: number
  nudged: number // distance (viewBox units) moved by the collision pass
}
export type MapCity = { name: string; x: number; y: number; label?: City['label'] }
export type MapLayout = { path: string; width: number; height: number; island: Rect; pins: MapPin[]; cities: MapCity[] }

export const PIN_RADIUS = 17 // collision radius in viewBox units (map is 1000 wide)
const MIN_GAP = PIN_RADIUS * 2 + 2
const MAX_PULL = 70 // a pin never ends up further than this from its true spot

function makeProjection() {
  return geoConicConformal()
    .rotate(outline.rotate as [number, number])
    .parallels(outline.parallels as [number, number])
    .scale(outline.scale)
    .translate(outline.translate as [number, number])
}

export function projectLatLng(lat: number, lng: number): [number, number] {
  return makeProjection()([lng, lat]) ?? [0, 0]
}

export function computeLayout(entries: Stop[]): MapLayout {
  const work: Work[] = []
  for (const d of entries) {
    if (d.lat === null || d.lng === null) continue
    const [x, y] = projectLatLng(d.lat, d.lng)
    work.push({ id: d.id, x0: x, y0: y, x, y })
  }
  relax(work, MIN_GAP, MAX_PULL)

  const r1 = (n: number) => Math.round(n * 10) / 10
  const cities = citiesData as City[]
  return {
    path: outline.path,
    width: outline.width,
    height: outline.height,
    island: islandRect(computeIsland(outline.path)),
    pins: work.map((p) => ({
      id: p.id,
      x0: r1(p.x0),
      y0: r1(p.y0),
      x: r1(p.x),
      y: r1(p.y),
      nudged: r1(Math.hypot(p.x - p.x0, p.y - p.y0)),
    })),
    cities: cities.map((c) => {
      const [x, y] = projectLatLng(c.lat, c.lng)
      return { name: c.name, x: r1(x), y: r1(y), label: c.label }
    }),
  }
}
