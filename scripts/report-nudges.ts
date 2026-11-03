// Lists pins moved by the build-time collision pass. Run: npx tsx scripts/report-nudges.ts
import { computeLayout } from '../src/lib/map-layout'
import data from '../src/data/stops.json'
import type { Stop } from '../src/data/types'

const entries = data as Stop[]
const { pins } = computeLayout(entries)
const moved = pins.filter((p) => p.nudged > 0.5).sort((a, b) => b.nudged - a.nudged)
console.log(`${pins.length} pins, ${moved.length} nudged`)
for (const p of moved) {
  const d = entries.find((e) => e.id === p.id)!
  console.log(`${d.name}: ${p.nudged} units`)
}
