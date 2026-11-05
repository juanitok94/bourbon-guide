// Fails (exit 1) if any two callout leader lines meet, at the widths we support and in every zoomable region view.
// Uses the same inputs and layout code as the live map (src/components/StateMap.tsx). Run: npx tsx scripts/check-leaders.ts
import regionsData from '../src/data/regions.json'
import type { RegionArea } from '../src/lib/regions'
import { computeLayout } from '../src/lib/map-layout'
import { RING_PX, countCrossings, fitView, layoutCallouts, leadersOf, type Rect } from '../src/lib/map-view'
import { VISITOR_STOPS } from '../src/lib/stops'

const WIDTHS = [320, 375, 768, 1280]
const REGIONS = regionsData as RegionArea[]
const layout = computeLayout(VISITOR_STOPS)
const whole: Rect = { ...layout.island }
const pinById = new Map(layout.pins.map((p) => [p.id, p]))
const majors = VISITOR_STOPS.filter((d) => d.scale === 'major' && pinById.has(d.id))
const independents = VISITOR_STOPS.filter((d) => d.scale === 'independent' && pinById.has(d.id))
const pins = majors.map((d) => ({
  id: d.id,
  lat: d.lat!,
  lng: d.lng!,
  x: pinById.get(d.id)!.x0,
  y: pinById.get(d.id)!.y0,
  city: d.city,
  region: d.region,
}))
const avoid = [...independents.map((d) => ({ x: pinById.get(d.id)!.x0, y: pinById.get(d.id)!.y0 })), ...layout.cities]

const views: { name: string; view: Rect }[] = [
  { name: 'whole state', view: whole },
  ...REGIONS.map((r) => ({ name: `region ${r.id}`, view: fitView(r.area, whole) })),
]

let failures = 0
let checked = 0
for (const { name, view } of views) {
  for (const pxW of WIDTHS) {
    const { frame, callouts } = layoutCallouts({ pins, avoid, view, whole, pxW })
    const leaders = leadersOf(frame, view, callouts)
    const n = countCrossings(leaders)
    checked++
    // Stamps never overlap each other or the ring: callout boxes stay apart, and band rows stay clear of the oval's ring.
    for (let i = 0; i < callouts.length; i++) {
      const a = callouts[i]
      if (a.x < 0 || a.x + a.w > frame.pxW) { failures++; console.error(`FAIL ${name} @ ${pxW}px: ${a.key} leaves the drawing`) }
      if (a.inBand && (a.labelAbove ? a.y + a.h > frame.ey - RING_PX : a.y < frame.ey + frame.eh + RING_PX)) { failures++; console.error(`FAIL ${name} @ ${pxW}px: ${a.key} touches the ring`) }
      for (const b of callouts.slice(i + 1)) {
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) { failures++; console.error(`FAIL ${name} @ ${pxW}px: ${a.key} overlaps ${b.key}`) }
      }
    }
    if (n > 0) {
      failures++
      console.error(`FAIL ${name} @ ${pxW}px: ${n} crossing leader pair(s) among ${leaders.length}`)
    } else if (process.argv.includes('--verbose')) {
      console.log(`ok   ${name} @ ${pxW}px: ${leaders.length} leaders, none cross`)
    }
  }
}
if (failures > 0) {
  console.error(`${failures} of ${checked} layouts have crossing leaders`)
  process.exit(1)
}
console.log(`Leaders: no crossings in ${checked} layouts (widths ${WIDTHS.join(', ')}; whole state and ${REGIONS.length} regions)`)
