// Zoomable map views: the SVG viewBox changes while pins and labels keep the same on-screen size, so their
// spacing depends on the view. Pure functions, no browser APIs. Everything here is deterministic.
export type Rect = { x: number; y: number; w: number; h: number }

export const PIN_PX = 30 // drawn circle pin width on screen (the bottle tag is 85% of this)
export const PIN_BASE = 27 // PinGraphic's circle width in its local coordinates, outline included
export const CITY_PX = 11 // city label font size on screen
export const REGION_PX = 12 // region label font size on screen
const MIN_VIEW_W = 260 // never zoom tighter than this many map units: labels need room

export type Work = { id: string; x0: number; y0: number; x: number; y: number; bound?: Rect | null }

// Simple relaxation: push overlapping pins apart, with a limit on how far one may leave its true spot.
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
      if (p.bound) {
        p.x = Math.max(p.bound.x, Math.min(p.x, p.bound.x + p.bound.w))
        p.y = Math.max(p.bound.y, Math.min(p.y, p.bound.y + p.bound.h))
      }
    }
    if (!moved) break
  }
}

// The viewBox that shows an area: same aspect as the map, so one map unit is the same size on both axes.
export function fitView(area: Rect, mapW: number, mapH: number): Rect {
  let w = Math.max(area.w, MIN_VIEW_W)
  let h = (w * mapH) / mapW
  if (h < area.h) {
    h = area.h
    w = (h * mapW) / mapH
  }
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  return { x: clamp(area.x + area.w / 2 - w / 2, mapW - w), y: clamp(area.y + area.h / 2 - h / 2, mapH - h), w, h }
}

export function lerpView(a: Rect, b: Rect, t: number): Rect {
  const at = (p: number, q: number) => p + (q - p) * t
  return { x: at(a.x, b.x), y: at(a.y, b.y), w: at(a.w, b.w), h: at(a.h, b.h) }
}

// Pin positions for one view, spaced for their on-screen size. A pin's bound keeps its centre inside that area
// (its region's button on the whole-state view), so a pin never appears to belong to a neighbouring region.
export function placePins(
  pins: { id: string; x: number; y: number; bound?: Rect | null }[],
  view: Rect,
  pxW: number,
): Map<string, { x: number; y: number }> {
  const u = view.w / pxW
  const gap = (PIN_PX + 3) * u
  const items: Work[] = pins.map((p) => ({ id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y, bound: p.bound }))
  relax(items, gap, gap * 1.8)
  return new Map(items.map((p) => [p.id, { x: p.x, y: p.y }]))
}

type Box = { x0: number; y0: number; x1: number; y1: number }
const hitsBox = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

export type Anchor = 'start' | 'middle' | 'end'
export type PlacedLabel = { text: string; x: number; y: number; anchor: Anchor; leader: boolean; cx: number; cy: number }

const boxOf = (px: number, py: number, anchor: Anchor, w: number, h: number): Box => {
  const x0 = anchor === 'start' ? px : anchor === 'end' ? px - w : px - w / 2
  return { x0, y0: py - h / 2, x1: x0 + w, y1: py + h / 2 }
}

// Labels are measured in screen pixels. A label that can't be placed clear of pins and other labels, inside the
// map, is left out for this view; the list and the regions' aria-labels still carry the names.
export function placeLabels({
  view,
  pxW,
  pins,
  cities,
  regions,
}: {
  view: Rect
  pxW: number
  pins: { x: number; y: number }[]
  cities: { name: string; x: number; y: number; label?: { dx: number; dy: number; anchor: Anchor } }[]
  regions: { id: string; label: string; box: Rect }[]
}): { cities: PlacedLabel[]; regions: (PlacedLabel & { id: string })[] } {
  const u = view.w / pxW
  const pxH = view.h / u
  const toX = (x: number) => (x - view.x) / u
  const toY = (y: number) => (y - view.y) / u
  const backX = (px: number) => view.x + px * u
  const backY = (py: number) => view.y + py * u
  const pinR = PIN_PX / 2 + 1
  const pinPx = pins.map((p) => ({ x: toX(p.x), y: toY(p.y) }))
  const placed: Box[] = []
  const dotOf = (c: { x: number; y: number }): Box => ({ x0: toX(c.x) - 3, y0: toY(c.y) - 3, x1: toX(c.x) + 3, y1: toY(c.y) + 3 })

  const inside = (b: Box) => b.x0 >= 2 && b.y0 >= 2 && b.x1 <= pxW - 2 && b.y1 <= pxH - 2
  const clearOfPins = (b: Box) =>
    !pinPx.some((p) => {
      const nx = Math.max(b.x0, Math.min(p.x, b.x1))
      const ny = Math.max(b.y0, Math.min(p.y, b.y1))
      return Math.hypot(p.x - nx, p.y - ny) < pinR
    })

  const regionBoxes = regions.map((r) => ({
    id: r.id,
    box: { x0: toX(r.box.x), y0: toY(r.box.y), x1: toX(r.box.x + r.box.w), y1: toY(r.box.y + r.box.h) },
  }))

  // Regions first: they are the phone's main targets. Never over a neighbouring region's box.
  const outRegions: (PlacedLabel & { id: string })[] = []
  for (const r of regionBoxes) {
    const def = regions.find((x) => x.id === r.id)!
    const w = def.label.length * 6.5 + 2
    const h = REGION_PX + 3
    // Centred on the box, but slid sideways if that would run off the map.
    const mx = Math.max(w / 2 + 3, Math.min((r.box.x0 + r.box.x1) / 2, pxW - w / 2 - 3))
    const my = (r.box.y0 + r.box.y1) / 2
    const candidates: { px: number; py: number; anchor: Anchor }[] = [
      { px: mx, py: r.box.y0 - h / 2 - 2, anchor: 'middle' },
      { px: mx, py: r.box.y1 + h / 2 + 2, anchor: 'middle' },
      { px: r.box.x0 - 4, py: my, anchor: 'end' },
      { px: r.box.x1 + 4, py: my, anchor: 'start' },
      // Narrow maps: above the box, pushed to the map's edge, clear of a neighbour on the other side.
      { px: pxW - 3, py: r.box.y0 - h / 2 - 2, anchor: 'end' },
      { px: 3, py: r.box.y0 - h / 2 - 2, anchor: 'start' },
      { px: pxW - 3, py: r.box.y1 + h / 2 + 2, anchor: 'end' },
      { px: 3, py: r.box.y1 + h / 2 + 2, anchor: 'start' },
      { px: mx, py: r.box.y0 + h / 2 + 2, anchor: 'middle' },
      { px: mx, py: r.box.y1 - h / 2 - 2, anchor: 'middle' },
    ]
    const others = regionBoxes.filter((o) => o.id !== r.id)
    const chosen = candidates.find((c) => {
      const b = boxOf(c.px, c.py, c.anchor, w, h)
      // A label must read as belonging to its box: beside it on one axis and overlapping it on the other.
      const overlapsX = b.x0 < r.box.x1 && r.box.x0 < b.x1
      const overlapsY = b.y0 < r.box.y1 && r.box.y0 < b.y1
      if (!overlapsX && !overlapsY) return false
      return inside(b) && clearOfPins(b) && !placed.some((q) => hitsBox(b, q)) && !others.some((o) => hitsBox(b, o.box))
    })
    if (!chosen) continue
    placed.push(boxOf(chosen.px, chosen.py, chosen.anchor, w, h))
    outRegions.push({
      id: r.id,
      text: def.label,
      x: backX(chosen.px),
      y: backY(chosen.py),
      anchor: chosen.anchor,
      leader: false,
      cx: 0,
      cy: 0,
    })
  }

  // Cities come second, so a city whose dot sits under a region label drops out of this view.
  const regionLabelBoxes = [...placed]
  const outCities: PlacedLabel[] = []
  for (const c of cities) {
    const cx = toX(c.x)
    const cy = toY(c.y)
    if (cx < 0 || cy < 0 || cx > pxW || cy > pxH) continue
    if (regionLabelBoxes.some((q) => hitsBox(dotOf(c), q))) continue
    const w = c.name.length * (CITY_PX * 0.8) + 2
    const h = CITY_PX + 2
    const candidates: { dx: number; dy: number; anchor: Anchor }[] = [
      ...(c.label ? [c.label] : []),
      { dx: 6, dy: 0, anchor: 'start' },
      { dx: -6, dy: 0, anchor: 'end' },
      { dx: 0, dy: 13, anchor: 'middle' },
      { dx: 0, dy: -13, anchor: 'middle' },
      { dx: 0, dy: 24, anchor: 'middle' },
      { dx: 0, dy: -24, anchor: 'middle' },
      { dx: 22, dy: 0, anchor: 'start' },
      { dx: -22, dy: 0, anchor: 'end' },
    ]
    const chosen = candidates.find((l) => {
      const b = boxOf(cx + l.dx, cy + l.dy, l.anchor, w, h)
      // No label on another city's dot.
      const onDot = cities.some((o) => o !== c && hitsBox(b, dotOf(o)))
      return inside(b) && clearOfPins(b) && !onDot && !placed.some((q) => hitsBox(b, q))
    })
    if (!chosen) continue
    placed.push(boxOf(cx + chosen.dx, cy + chosen.dy, chosen.anchor, w, h))
    outCities.push({
      text: c.name,
      x: backX(cx + chosen.dx),
      y: backY(cy + chosen.dy),
      anchor: chosen.anchor,
      leader: Math.abs(chosen.dx) > 12 || Math.abs(chosen.dy) > 16,
      cx: c.x,
      cy: c.y,
    })
  }
  return { cities: outCities, regions: outRegions }
}
