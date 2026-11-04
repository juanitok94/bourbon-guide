// Works out each map.json region's area on the map from its stops' true coordinates. Run by npm run build:regions,
// which writes src/data/regions.json; check:data recomputes it and fails if that file is out of date.
// - area: a padded bounding box around the region's pins; zooming fits this.
// - target: the region's button on the map. It starts around the pins and grows outward until it reaches
//   MIN_TARGET or meets a neighbour, so targets never overlap and always contain their own pins.
// Regions with no pins have no entry: they stay in the dropdown but have nothing to zoom to.
import { MAP, type Stop } from '../data/types'
import { projectLatLng } from './map-layout'
import type { Rect } from './map-view'

export type RegionArea = { id: string; area: Rect; target: Rect }

const AREA_PAD = 35
const SEED_PAD = 6
// 44px at the narrowest phone we support: a 320px screen draws the map about 286px wide (1000 units).
export const MIN_TARGET = 155

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const r1 = (n: number) => Math.round(n * 10) / 10

export function computeRegions(stops: Stop[], mapW: number, mapH: number): RegionArea[] {
  const found: { id: string; x0: number; y0: number; x1: number; y1: number }[] = []
  for (const region of MAP.regions) {
    const points = stops
      .filter((d) => d.region === region.id && d.status !== 'closed' && d.lat !== null && d.lng !== null)
      .map((d) => projectLatLng(d.lat!, d.lng!))
    if (points.length === 0) continue
    const xs = points.map((p) => p[0])
    const ys = points.map((p) => p[1])
    found.push({ id: region.id, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
  }

  const targets: Rect[] = found.map((f) => ({
    x: f.x0 - SEED_PAD,
    y: f.y0 - SEED_PAD,
    w: f.x1 - f.x0 + SEED_PAD * 2,
    h: f.y1 - f.y0 + SEED_PAD * 2,
  }))

  // Grow one unit a side at a time, round robin, so neighbours share the space between them fairly.
  const steps: ((r: Rect) => Rect)[] = [
    (r) => ({ ...r, x: r.x - 1, w: r.w + 1 }),
    (r) => ({ ...r, w: r.w + 1 }),
    (r) => ({ ...r, y: r.y - 1, h: r.h + 1 }),
    (r) => ({ ...r, h: r.h + 1 }),
  ]
  for (let round = 0, changed = true; changed && round < 1000; round++) {
    changed = false
    targets.forEach((target, i) => {
      steps.forEach((step, s) => {
        const horizontal = s < 2
        if ((horizontal ? targets[i].w : targets[i].h) >= MIN_TARGET) return
        const next = step(targets[i])
        const inMap = next.x >= 0 && next.y >= 0 && next.x + next.w <= mapW && next.y + next.h <= mapH
        if (inMap && !targets.some((o, j) => j !== i && overlap(next, o))) {
          targets[i] = next
          changed = true
        }
      })
      void target
    })
  }

  return found.map((f, i) => ({
    id: f.id,
    area: {
      x: r1(f.x0 - AREA_PAD),
      y: r1(f.y0 - AREA_PAD),
      w: r1(f.x1 - f.x0 + AREA_PAD * 2),
      h: r1(f.y1 - f.y0 + AREA_PAD * 2),
    },
    target: { x: r1(targets[i].x), y: r1(targets[i].y), w: r1(targets[i].w), h: r1(targets[i].h) },
  }))
}

// Rule violations for check:data. Empty means the regions are usable.
export function regionProblems(regions: RegionArea[]): string[] {
  const out: string[] = []
  regions.forEach((r, i) => {
    if (r.target.w < MIN_TARGET || r.target.h < MIN_TARGET)
      out.push(`regions.json ${r.id}: target is ${r.target.w}x${r.target.h}, needs at least ${MIN_TARGET} each way (44px on a phone)`)
    regions.slice(i + 1).forEach((o) => {
      if (overlap(r.target, o.target)) out.push(`regions.json: targets for ${r.id} and ${o.id} overlap`)
    })
  })
  return out
}
