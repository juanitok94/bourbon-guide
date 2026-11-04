// The oval the state sits in, worked out at build time from the outline itself. Pure functions, no browser APIs.
// An ellipse drawn from the bounding box plus 8% would cut off the state's corners (Kentucky's far west, for one), so
// this finds the smallest ellipse at ISLAND_RATIO that holds every point of the outline, then adds a small margin.
import type { Rect } from '@/lib/map-view'

export type Island = { cx: number; cy: number; rx: number; ry: number }

export const ISLAND_RATIO = 2.3 // width to height
const MARGIN = 1.02 // room for the state's outline stroke

// Points of an SVG path made only of M, L and Z commands, which is what geoPath writes.
export function pathPoints(path: string): [number, number][] {
  const nums = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const points: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
  return points
}

export function computeIsland(path: string, ratio = ISLAND_RATIO): Island {
  const points = pathPoints(path)
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2
  // The vertical radius needed if the centre is at (cx, cy).
  const needed = (cx: number, cy: number) => {
    let most = 0
    for (const [x, y] of points) most = Math.max(most, Math.hypot((x - cx) / ratio, y - cy))
    return most
  }
  let best = { cx: midX, cy: midY, ry: needed(midX, midY) }
  const spanX = (x1 - x0) / 4
  const spanY = (y1 - y0) / 4
  const steps = 40
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const cx = midX + (i / steps) * spanX
      const cy = midY + (j / steps) * spanY
      const ry = needed(cx, cy)
      if (ry < best.ry) best = { cx, cy, ry }
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10
  const ry = best.ry * MARGIN
  return { cx: r1(best.cx), cy: r1(best.cy), rx: r1(ry * ratio), ry: r1(ry) }
}

export const islandRect = (i: Island): Rect => ({ x: i.cx - i.rx, y: i.cy - i.ry, w: i.rx * 2, h: i.ry * 2 })
