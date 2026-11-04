// Zoomable map views. The SVG is drawn in screen pixels: the state zooms inside the oval by changing a nested
// viewBox, while stamps, dots and labels keep their on-screen size at every zoom. Pure functions, no browser APIs.
export type Rect = { x: number; y: number; w: number; h: number }

export const RING_PX = 8 // from the edge of the drawing to the oval's gold border
export const CELL_PX = 44 // one stamp's target; stamps sit side by side at this pitch and never overlap
export const STAMP_PX = 28 // the square stamp itself
export const DOT_R = 5 // an independent's gold dot
export const LABEL_PX = 10 // callout and city labels
const LINE_H = 13
const CHAR_W = 6.4 // IBM Plex Mono is 0.6em wide, plus the letter spacing
const BAND_BELOW_PX = 600 // narrower than this, callouts sit outside the oval: there is no room for 44px targets in it
const CLUSTER_KM = 40 // at the whole-state view; it tightens as the map zooms in
const MIN_VIEW_W = 260 // never zoom tighter than this many map units

export type Work = { id: string; x0: number; y0: number; x: number; y: number }

// Simple relaxation: push overlapping points apart, with a limit on how far one may leave its true spot.
export function relax(items: Work[], gap: number, maxPull: number): void {
  for (let iter = 0; iter < 200; iter++) {
    let moved = false
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        if (dist >= gap) continue
        if (dist < 0.01) {
          // identical spots: separate along a fixed, deterministic direction
          const ang = ((i * 7 + j * 3) % 12) * (Math.PI / 6)
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          dist = 1
        }
        const push = (gap - dist) / 2
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
      if (d > maxPull) {
        p.x = p.x0 + (dx / d) * maxPull
        p.y = p.y0 + (dy / d) * maxPull
      }
    }
    if (!moved) break
  }
}

// The view that shows an area inside the oval. A rectangle fits an ellipse only at 1/sqrt(2) of its size, so the
// view is that much bigger than the area. Same aspect as the whole island, so a map unit is square on screen.
export function fitView(area: Rect, whole: Rect): Rect {
  const aspect = whole.w / whole.h
  let w = Math.max(area.w * Math.SQRT2, MIN_VIEW_W)
  let h = w / aspect
  if (h < area.h * Math.SQRT2) {
    h = area.h * Math.SQRT2
    w = h * aspect
  }
  if (w >= whole.w) return whole
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
  return {
    x: clamp(area.x + area.w / 2 - w / 2, whole.x, whole.x + whole.w - w),
    y: clamp(area.y + area.h / 2 - h / 2, whole.y, whole.y + whole.h - h),
    w,
    h,
  }
}

export function lerpView(a: Rect, b: Rect, t: number): Rect {
  const at = (p: number, q: number) => p + (q - p) * t
  return { x: at(a.x, b.x), y: at(a.y, b.y), w: at(a.w, b.w), h: at(a.h, b.h) }
}

// Where the oval sits in the drawing. bandH is the room kept above and below it for callouts on narrow screens.
export type Frame = { pxW: number; pxH: number; ex: number; ey: number; ew: number; eh: number; bandH: number }

export function makeFrame(pxW: number, aspect: number, bandH: number): Frame {
  const ew = pxW - RING_PX * 2
  const eh = ew / aspect
  return { pxW, pxH: bandH * 2 + eh + RING_PX * 2, ex: RING_PX, ey: bandH + RING_PX, ew, eh, bandH }
}

// Map units to drawing pixels for one view.
export function toPx(f: Frame, view: Rect, x: number, y: number): { x: number; y: number } {
  const k = f.ew / view.w
  return { x: f.ex + (x - view.x) * k, y: f.ey + (y - view.y) * k }
}

export function inOval(f: Frame, x: number, y: number, inset = 0): boolean {
  const a = f.ew / 2 - inset
  const b = f.eh / 2 - inset
  return ((x - (f.ex + f.ew / 2)) / a) ** 2 + ((y - (f.ey + f.eh / 2)) / b) ** 2 <= 1
}

export type StampPin = { id: string; lat: number; lng: number; x: number; y: number; city: string | null; region: string | null }

const km = (a: StampPin, b: StampPin) => {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Pins join a cluster when one is within radiusKm of another in the same region. Without the region rule the chain
// Loretto, Bardstown, Clermont, Louisville would merge three separate destinations into one callout.
export function clusterPins(pins: StampPin[], radiusKm: number): StampPin[][] {
  const parent = pins.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  pins.forEach((a, i) => {
    pins.forEach((b, j) => {
      if (j > i && a.region === b.region && km(a, b) <= radiusKm) parent[find(j)] = find(i)
    })
  })
  const groups = new Map<number, StampPin[]>()
  pins.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]))
  return [...groups.values()].map((g) => [...g].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)))
}

export type Callout = {
  key: string
  lines: string[] // the label, wrapped
  labelAbove: boolean // the stamps sit on the side nearer the true positions
  inBand: boolean // outside the oval, so the label sits on the page rather than the island
  x: number
  y: number
  w: number
  h: number
  cells: { pin: StampPin; cx: number; cy: number }[]
}

type Box = { x0: number; y0: number; x1: number; y1: number }
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const boxDistance = (p: { x: number; y: number }, b: Box) =>
  Math.hypot(p.x - Math.max(b.x0, Math.min(p.x, b.x1)), p.y - Math.max(b.y0, Math.min(p.y, b.y1)))

function wrapLabel(names: string[], maxW: number): string[] {
  const lines: string[] = []
  for (const name of names) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last.length + 3 + name.length) * CHAR_W <= maxW) lines[lines.length - 1] = `${last} · ${name}`
    else lines.push(name)
  }
  return lines
}

type Draft = { pins: StampPin[]; lines: string[]; w: number; h: number; key: string }

function draftOf(pins: StampPin[], maxW: number): Draft {
  const names = [...new Set(pins.map((p) => p.city).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b))
  const lines = wrapLabel(names, maxW)
  const labelW = Math.max(0, ...lines.map((l) => l.length * CHAR_W))
  return {
    pins,
    lines,
    w: Math.max(pins.length * CELL_PX, labelW),
    h: CELL_PX + lines.length * LINE_H,
    key: pins.map((p) => p.id).join('+'),
  }
}

function finish(d: Draft, x: number, y: number, labelAbove: boolean, inBand: boolean): Callout {
  const rowY = labelAbove ? y + d.h - CELL_PX : y
  const startX = x + (d.w - d.pins.length * CELL_PX) / 2
  return {
    key: d.key,
    lines: d.lines,
    labelAbove,
    inBand,
    x,
    y,
    w: d.w,
    h: d.h,
    cells: d.pins.map((pin, i) => ({ pin, cx: startX + CELL_PX * (i + 0.5), cy: rowY + CELL_PX / 2 })),
  }
}

// Places every cluster inside the oval, as near its true positions as it can, or returns null if one won't fit.
// `avoid` holds things better left uncovered (dots, reference cities): a cost, not a rule.
function placeInOval(drafts: Draft[], f: Frame, view: Rect, avoid: { x: number; y: number }[]): Callout[] | null {
  const spots = drafts.flatMap((d) => d.pins.map((p) => toPx(f, view, p.x, p.y)))
  const avoidPx = avoid.map((d) => toPx(f, view, d.x, d.y))
  const placed: Callout[] = []
  const boxes: Box[] = []
  for (const d of drafts) {
    const own = d.pins.map((p) => toPx(f, view, p.x, p.y))
    const anchor = { x: own.reduce((s, p) => s + p.x, 0) / own.length, y: own.reduce((s, p) => s + p.y, 0) / own.length }
    let best: { x: number; y: number; cost: number } | null = null
    for (let y = f.ey; y + d.h <= f.ey + f.eh; y += 6) {
      for (let x = f.ex; x + d.w <= f.ex + f.ew; x += 6) {
        const b: Box = { x0: x, y0: y, x1: x + d.w, y1: y + d.h }
        if (![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([px, py]) => inOval(f, px, py, 8))) continue
        const pad: Box = { x0: b.x0 - 6, y0: b.y0 - 6, x1: b.x1 + 6, y1: b.y1 + 6 }
        if (boxes.some((o) => hits(pad, o))) continue
        if (spots.some((s) => s.x > pad.x0 && s.x < pad.x1 && s.y > pad.y0 && s.y < pad.y1)) continue
        const covered = avoidPx.filter((s) => s.x > b.x0 - 4 && s.x < b.x1 + 4 && s.y > b.y0 - 4 && s.y < b.y1 + 4).length
        const distance = boxDistance(anchor, b)
        if (distance < 14) continue // keep the leader long enough to read as one
        const cost = distance + covered * 40
        if (!best || cost < best.cost) best = { x, y, cost }
      }
    }
    if (!best) return null
    const c = finish(d, best.x, best.y, best.y + d.h / 2 < anchor.y, false)
    placed.push(c)
    boxes.push({ x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h })
  }
  return placed
}

// Places every cluster in rows above and below the oval, or returns null if they don't fit in this many rows.
// The northern half prefers the rows above and the southern half those below, so leaders don't cross.
function placeInBands(drafts: Draft[], f: Frame, view: Rect, rowH: number, rows: number): Callout[] | null {
  const placed: Callout[] = []
  const boxes: Box[] = []
  const rowTops: { y: number; above: boolean }[] = []
  for (let r = 0; r < rows; r++) {
    rowTops.push({ y: f.bandH - rowH * (r + 1), above: true })
    rowTops.push({ y: f.pxH - f.bandH + rowH * r + 2, above: false })
  }
  const anchorOf = (d: Draft) => {
    const own = d.pins.map((p) => toPx(f, view, p.x, p.y))
    return { x: own.reduce((s, p) => s + p.x, 0) / own.length, y: own.reduce((s, p) => s + p.y, 0) / own.length }
  }
  const northToSouth = [...drafts].sort((a, b) => anchorOf(a).y - anchorOf(b).y || a.key.localeCompare(b.key))
  for (const d of drafts) {
    const anchor = anchorOf(d)
    const prefersAbove = northToSouth.indexOf(d) < drafts.length / 2
    let best: { x: number; y: number; above: boolean; cost: number } | null = null
    for (const row of rowTops) {
      for (let x = 2; x + d.w <= f.pxW - 2; x += 4) {
        const b: Box = { x0: x, y0: row.y, x1: x + d.w, y1: row.y + d.h }
        if (boxes.some((o) => hits({ ...b, x0: b.x0 - 6, x1: b.x1 + 6 }, o))) continue
        const cost = boxDistance(anchor, b) + (row.above === prefersAbove ? 0 : 1000)
        if (!best || cost < best.cost) best = { x, y: row.y, above: row.above, cost }
      }
    }
    if (!best) return null
    const c = finish(d, best.x, best.y, best.above, true)
    placed.push(c)
    boxes.push({ x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h })
  }
  return placed
}

// Clusters the stamps for one view and finds them room. Biggest clusters choose first, then by id, so it is deterministic.
export function layoutCallouts({
  pins,
  avoid,
  view,
  whole,
  pxW,
}: {
  pins: StampPin[]
  avoid: { x: number; y: number }[]
  view: Rect
  whole: Rect
  pxW: number
}): { frame: Frame; callouts: Callout[] } {
  const aspect = whole.w / whole.h
  const narrow = pxW < BAND_BELOW_PX
  const drafts = clusterPins(pins, (CLUSTER_KM * view.w) / whole.w)
    .map((g) => draftOf(g, narrow ? pxW - 8 : 300))
    .sort((a, b) => b.pins.length - a.pins.length || a.key.localeCompare(b.key))
  if (drafts.length === 0) return { frame: makeFrame(pxW, aspect, 0), callouts: [] }

  if (!narrow) {
    const frame = makeFrame(pxW, aspect, 0)
    const inside = placeInOval(drafts, frame, view, avoid)
    if (inside) return { frame, callouts: inside }
  }
  const rowH = Math.max(...drafts.map((d) => d.h)) + 4
  for (let rows = 1; ; rows++) {
    const frame = makeFrame(pxW, aspect, rows * rowH + 2)
    const inBands = placeInBands(drafts, frame, view, rowH, rows)
    if (inBands) return { frame, callouts: inBands }
  }
}

// Independents: gold dots at their true spots, nudged only as far as it takes for two not to sit on each other.
export function placeDots(
  dots: { id: string; x: number; y: number }[],
  view: Rect,
  ovalPxW: number,
): Map<string, { x: number; y: number }> {
  const u = view.w / ovalPxW
  const gap = (DOT_R * 2 + 2) * u
  const items: Work[] = dots.map((p) => ({ id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y }))
  relax(items, gap, gap * 1.8)
  return new Map(items.map((p) => [p.id, { x: p.x, y: p.y }]))
}

export type CityLabel = { name: string; dotX: number; dotY: number; x: number; y: number; anchor: 'start' | 'middle' | 'end' }

// Reference cities with no callout of their own. One that can't be placed clear of everything is left out of this view.
export function placeCities({
  frame,
  view,
  cities,
  callouts,
  spots,
}: {
  frame: Frame
  view: Rect
  cities: { name: string; x: number; y: number }[]
  callouts: Callout[]
  spots: { x: number; y: number }[]
}): CityLabel[] {
  const named = new Set(callouts.flatMap((c) => c.cells.map((cell) => cell.pin.city)))
  const blocked: Box[] = callouts.map((c) => ({ x0: c.x - 4, y0: c.y - 4, x1: c.x + c.w + 4, y1: c.y + c.h + 4 }))
  for (const s of spots) blocked.push({ x0: s.x - 8, y0: s.y - 8, x1: s.x + 8, y1: s.y + 8 })
  const out: CityLabel[] = []
  for (const c of cities) {
    if (named.has(c.name)) continue
    const dot = toPx(frame, view, c.x, c.y)
    if (!inOval(frame, dot.x, dot.y, 4)) continue
    const w = c.name.length * CHAR_W
    const h = LINE_H
    const options: { dx: number; dy: number; anchor: CityLabel['anchor'] }[] = [
      { dx: 6, dy: 0, anchor: 'start' },
      { dx: -6, dy: 0, anchor: 'end' },
      { dx: 0, dy: 11, anchor: 'middle' },
      { dx: 0, dy: -11, anchor: 'middle' },
    ]
    const dotBox: Box = { x0: dot.x - 3, y0: dot.y - 3, x1: dot.x + 3, y1: dot.y + 3 }
    if (blocked.some((b) => hits(dotBox, b))) continue
    for (const o of options) {
      const x0 = o.anchor === 'start' ? dot.x + o.dx : o.anchor === 'end' ? dot.x + o.dx - w : dot.x + o.dx - w / 2
      const y0 = dot.y + o.dy - h / 2
      const b: Box = { x0, y0, x1: x0 + w, y1: y0 + h }
      if (blocked.some((q) => hits(b, q))) continue
      if (![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([px, py]) => inOval(frame, px, py, 6))) continue
      blocked.push(b, dotBox)
      out.push({ name: c.name, dotX: dot.x, dotY: dot.y, x: dot.x + o.dx, y: dot.y + o.dy, anchor: o.anchor })
      break
    }
  }
  return out
}
