// Build-time layout for the static SVG map. Pure functions, no browser APIs.
// Pins appear only for entries with verified lat/lng. The outline is built for map.json's state.
import { geoConicConformal } from 'd3-geo'
import citiesData from '@/data/cities.json'
import outline from '@/data/outline.json'
import type { City, Stop } from '@/data/types'

export type MapPin = {
  id: string
  x: number
  y: number
  nudged: number // distance (viewBox units) moved by the collision pass
}
export type MapCity = { name: string; x: number; y: number; label: City['label'] }
export type MapLayout = { path: string; counties: string; width: number; height: number; pins: MapPin[]; cities: MapCity[] }

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

type Work = { id: string; x0: number; y0: number; x: number; y: number }

// Simple relaxation: push overlapping pins apart, with a spring back toward the true spot.
function relax(items: Work[]): void {
  for (let iter = 0; iter < 200; iter++) {
    let moved = false
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        if (dist >= MIN_GAP) continue
        if (dist < 0.01) {
          // identical spots: separate along a fixed, deterministic direction
          const ang = ((i * 7 + j * 3) % 12) * (Math.PI / 6)
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          dist = 1
        }
        const push = (MIN_GAP - dist) / 2
        const ux = dx / dist
        const uy = dy / dist
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
        moved = true
      }
    }
    for (const p of items) {
      const dx = p.x - p.x0
      const dy = p.y - p.y0
      const d = Math.hypot(dx, dy)
      if (d > MAX_PULL) {
        p.x = p.x0 + (dx / d) * MAX_PULL
        p.y = p.y0 + (dy / d) * MAX_PULL
      }
    }
    if (!moved) break
  }
}

export function computeLayout(entries: Stop[]): MapLayout {
  const proj = makeProjection()
  const project = (lat: number, lng: number): [number, number] => proj([lng, lat]) ?? [0, 0]

  const work: Work[] = []
  for (const d of entries) {
    if (d.lat === null || d.lng === null) continue
    const [x, y] = project(d.lat, d.lng)
    work.push({ id: d.id, x0: x, y0: y, x, y })
  }
  relax(work)

  const r1 = (n: number) => Math.round(n * 10) / 10
  const cities = citiesData as City[]
  return {
    path: outline.path,
    counties: outline.counties,
    width: outline.width,
    height: outline.height,
    pins: work.map((p) => ({
      id: p.id,
      x: r1(p.x),
      y: r1(p.y),
      nudged: r1(Math.hypot(p.x - p.x0, p.y - p.y0)),
    })),
    cities: cities.map((c) => {
      const [x, y] = project(c.lat, c.lng)
      return { name: c.name, x: r1(x), y: r1(y), label: c.label }
    }),
  }
}
