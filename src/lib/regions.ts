// Works out each map.json region's area on the map from its stops' true coordinates. Run by npm run build:regions,
// which writes src/data/regions.json; check:data recomputes it and fails if that file is out of date.
// - area: a padded bounding box around the region's pins; zooming fits this.
// - target: the region's button on the map. It starts at the centre of the region's pins and grows outward until it
//   reaches MIN_TARGET or meets a neighbour, which then slides away if it can, so targets never overlap. It need not
//   hold every pin: stamps sit in callouts, and a region's pins can spread further than one button.
// Regions with no pins, or scattered too widely for a zoom to help ("elsewhere" usually is), have no entry: they stay
// in the dropdown, which still filters the list, but have nothing to zoom to.
import outline from '../data/outline.json'
import { MAP, type Stop } from '../data/types'
import { computeIsland } from './island'
import { projectLatLng } from './map-layout'
import { CELL_PX, RING_PX, type Rect } from './map-view'

export type RegionArea = { id: string; area: Rect; target: Rect }

const AREA_PAD = 35
const SEED_PAD = 6
const MAX_AREA_SHARE = 0.4 // of the oval's width or height; wider than this a region is scattered, not a place
// 44px at the narrowest phone we support: a 320px screen has a 288px column, and the oval sits inside its rings.
const SMALLEST_OVAL_PX = 288 - RING_PX * 2
const ISLAND = computeIsland(outline.path)
export const MIN_TARGET = Math.ceil((CELL_PX * ISLAND.rx * 2) / SMALLEST_OVAL_PX)

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
    const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    if (box.x1 - box.x0 > ISLAND.rx * 2 * MAX_AREA_SHARE || box.y1 - box.y0 > ISLAND.ry * 2 * MAX_AREA_SHARE) continue
    found.push({ id: region.id, ...box })
  }

  const seeds: Rect[] = found.map((f) => ({
    x: (f.x0 + f.x1) / 2 - SEED_PAD,
    y: (f.y0 + f.y1) / 2 - SEED_PAD,
    w: SEED_PAD * 2,
    h: SEED_PAD * 2,
  }))
  const targets: Rect[] = seeds.map((r) => ({ ...r }))

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

  // A target still short has met a neighbour with nowhere left to share. Slide that neighbour along, as long as it
  // still covers where it started and stays clear of everything else.
  const contains = (r: Rect, seed: Rect) =>
    r.x <= seed.x && r.y <= seed.y && r.x + r.w >= seed.x + seed.w && r.y + r.h >= seed.y + seed.h
  const inMap = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= mapW && r.y + r.h <= mapH
  const slides: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let round = 0, changed = true; changed && round < 1000; round++) {
    changed = false
    targets.forEach((_, i) => {
      steps.forEach((step, s) => {
        const horizontal = s < 2
        if ((horizontal ? targets[i].w : targets[i].h) >= MIN_TARGET) return
        const next = step(targets[i])
        if (!inMap(next)) return
        const blockers = targets.flatMap((o, j) => (j !== i && overlap(next, o) ? [j] : []))
        if (blockers.length !== 1) return
        const j = blockers[0]
        const [dx, dy] = slides[s]
        const moved = { ...targets[j], x: targets[j].x + dx, y: targets[j].y + dy }
        if (!inMap(moved) || !contains(moved, seeds[j]) || overlap(next, moved)) return
        if (targets.some((o, k) => k !== i && k !== j && (overlap(moved, o) || overlap(next, o)))) return
        targets[i] = next
        targets[j] = moved
        changed = true
      })
    })
  }

  // A target that still can't reach MIN_TARGET (its seed is boxed in by a neighbour or the map edge, as with a lone pin near
  // the top of the oval) means that region has no button on the map. It keeps its place in the dropdown, which filters the
  // list without zooming, the same as a scattered region.
  const usable = found.map((_, i) => targets[i].w >= MIN_TARGET && targets[i].h >= MIN_TARGET)
  return found
    .map((f, i) => ({
      id: f.id,
      area: {
        x: r1(f.x0 - AREA_PAD),
        y: r1(f.y0 - AREA_PAD),
        w: r1(f.x1 - f.x0 + AREA_PAD * 2),
        h: r1(f.y1 - f.y0 + AREA_PAD * 2),
      },
      target: { x: r1(targets[i].x), y: r1(targets[i].y), w: r1(targets[i].w), h: r1(targets[i].h) },
    }))
    .filter((_, i) => usable[i])
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
