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
type Label = NonNullable<City['label']>
export type MapCity = { name: string; x: number; y: number; label: Label & { leader: boolean } }
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

// City labels: keep the configured (or default, right-hand) spot unless it would sit under a pin or another
// label; then try left, below, above, and finally further out with a leader line. Pins always win.
const PIN_VISUAL_R = 14 // drawn pin radius incl. outline (scale 1.15), viewBox units
const LABEL_H = 12
const labelWidth = (name: string) => name.length * 8.4 + 2 // 10.5px semibold caps + 1.2 letter-spacing
type Box = { x0: number; y0: number; x1: number; y1: number }
function boxOf(cx: number, cy: number, l: Label, w: number): Box {
  const tx = cx + l.dx
  const ty = cy + l.dy
  const x0 = l.anchor === 'start' ? tx : l.anchor === 'end' ? tx - w : tx - w / 2
  return { x0, y0: ty - LABEL_H / 2, x1: x0 + w, y1: ty + LABEL_H / 2 }
}
const hitsPin = (b: Box, p: { x: number; y: number }) => {
  const nx = Math.max(b.x0, Math.min(p.x, b.x1))
  const ny = Math.max(b.y0, Math.min(p.y, b.y1))
  return Math.hypot(p.x - nx, p.y - ny) < PIN_VISUAL_R
}
const hitsBox = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

function placeLabels(cities: { name: string; x: number; y: number; label?: Label }[], pins: { x: number; y: number }[]) {
  const placed: Box[] = []
  return cities.map((c) => {
    const w = labelWidth(c.name)
    const first: Label = c.label ?? { dx: 6, dy: 0, anchor: 'start' }
    const candidates: Label[] = [
      first,
      { dx: 6, dy: 0, anchor: 'start' },
      { dx: -6, dy: 0, anchor: 'end' },
      { dx: 0, dy: 13, anchor: 'middle' },
      { dx: 0, dy: -13, anchor: 'middle' },
      { dx: 0, dy: 22, anchor: 'middle' },
      { dx: 0, dy: -22, anchor: 'middle' },
      { dx: 20, dy: 0, anchor: 'start' },
      { dx: -20, dy: 0, anchor: 'end' },
    ]
    const ok = (l: Label) => {
      const b = boxOf(c.x, c.y, l, w)
      return !pins.some((p) => hitsPin(b, p)) && !placed.some((q) => hitsBox(b, q))
    }
    const chosen = candidates.find(ok) ?? first
    placed.push(boxOf(c.x, c.y, chosen, w))
    return { ...chosen, leader: Math.abs(chosen.dx) > 12 || Math.abs(chosen.dy) > 16 }
  })
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
    cities: (() => {
      const pts = cities.map((c) => {
        const [x, y] = project(c.lat, c.lng)
        return { name: c.name, x: r1(x), y: r1(y), label: c.label }
      })
      const labels = placeLabels(pts, work)
      return pts.map((c, i) => ({ ...c, label: labels[i] }))
    })(),
  }
}
