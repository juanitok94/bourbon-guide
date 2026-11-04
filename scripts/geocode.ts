// Fill lat/lng for stops that have a verified address but no coordinates, using OpenStreetMap Nominatim.
//
//   npm run geocode            query Nominatim and write accepted results to src/data/stops.json
//   npm run geocode -- --dry   query and report only
//
// Rules (CLAUDE.md, "Never guess"):
// - Only stops with an address AND verifiedOn AND null lat/lng are queried.
// - A result is accepted only if it is in the state (map.json stateName), inside the outline's bounding box,
//   its OSM city/town/village/hamlet matches the stop's city, and it is a house-number or named-place match
//   (not just a road). Tries the address first, then the stop's name + city. Otherwise: "needs manual check".
// - Stops with no address are listed as "needs address"; nothing is guessed.
// - Nominatim usage policy: identifying User-Agent, at most 1 request per second (we wait 1.1 s).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAP, type Stop } from '../src/data/types'

const UA = 'map-guides (Peachy Kean DevOps)'
const SOURCE = 'OpenStreetMap Nominatim'
const GAP_MS = 1100

const stopsPath = join(process.cwd(), 'src/data/stops.json')
const outline = JSON.parse(readFileSync(join(process.cwd(), 'src/data/outline.json'), 'utf8')) as {
  bounds: { south: number; north: number; west: number; east: number }
}
const BOX = outline.bounds
const stateName = MAP.stateName ?? MAP.state

type Hit = {
  lat: string
  lon: string
  display_name: string
  category?: string
  type?: string
  address?: Record<string, string>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let last = 0
async function search(params: Record<string, string>): Promise<Hit[]> {
  const wait = last + GAP_MS - Date.now()
  if (wait > 0) await sleep(wait)
  last = Date.now()
  const qs = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'us',
    // Restrict to the state's bounding box as well as filtering by state name below.
    viewbox: `${BOX.west},${BOX.north},${BOX.east},${BOX.south}`,
    bounded: '1',
    ...params,
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  return (await res.json()) as Hit[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
const PLACE_KEYS = ['city', 'town', 'village', 'hamlet', 'municipality', 'suburb']

function check(stop: Stop, h: Hit): string | null {
  const lat = Number(h.lat)
  const lng = Number(h.lon)
  // A bare road match (no house number, no named place) is only the road's midpoint, which can be
  // kilometres from the stop. Never accept it.
  if (h.category === 'highway') return 'road-level match only'
  if (!(lat >= BOX.south && lat <= BOX.north && lng >= BOX.west && lng <= BOX.east)) return 'outside bounding box'
  const a = h.address ?? {}
  if (a.state !== stateName) return `state is ${a.state ?? 'missing'}`
  const places = PLACE_KEYS.map((k) => a[k]).filter(Boolean)
  if (!stop.city || !places.some((p) => norm(p) === norm(stop.city!)))
    return `city ${places.join('/') || 'missing'} != ${stop.city}`
  return null
}

// "568 Happy Hollow Rd., Clermont, KY 40110" -> street + postcode for a structured query.
function parts(address: string) {
  const bits = address.split(',').map((s) => s.trim())
  const zip = address.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1]
  return { street: bits[0], zip }
}

async function geocode(stop: Stop): Promise<{ lat: number; lng: number; via: string } | { reason: string }> {
  const { street, zip } = parts(stop.address!)
  const attempts: [string, Record<string, string>][] = [
    ['structured', { street, city: stop.city ?? '', state: stateName, ...(zip ? { postalcode: zip } : {}) }],
    ['structured, no ZIP', { street, city: stop.city ?? '', state: stateName }],
    ['free text', { q: stop.address! }],
    // Fallback: the place's own OSM feature, found by name. Same state/box/city checks apply.
    ['name', { q: `${stop.name}, ${stop.city ?? ''}, ${stateName}` }],
  ]
  const reasons: string[] = []
  for (const [label, params] of attempts) {
    const hits = await search(params)
    if (!hits.length) {
      reasons.push(`${label}: no result`)
      continue
    }
    for (const h of hits) {
      const why = check(stop, h)
      if (!why) {
        return { lat: Number(Number(h.lat).toFixed(5)), lng: Number(Number(h.lon).toFixed(5)), via: `${label}: ${h.display_name}` }
      }
      reasons.push(`${label}: rejected ${h.display_name} (${why})`)
    }
  }
  return { reason: reasons.join('; ') }
}

async function main() {
  const dry = process.argv.includes('--dry')
  const stops = JSON.parse(readFileSync(stopsPath, 'utf8')) as Stop[]
  const filled: string[] = []
  const manual: string[] = []
  const noAddress: string[] = []

  for (const s of stops) {
    if (s.lat !== null && s.lng !== null) continue
    if (!s.address) {
      noAddress.push(s.id)
      continue
    }
    if (!s.verifiedOn) continue
    const r = await geocode(s)
    if ('reason' in r) {
      manual.push(`${s.id}: ${r.reason}`)
      continue
    }
    s.lat = r.lat
    s.lng = r.lng
    s.geocodeSource = SOURCE
    filled.push(`${s.id}: ${r.lat}, ${r.lng}  (${r.via})`)
  }

  console.log(`geocoded (${filled.length}):`)
  filled.forEach((l) => console.log(`  ${l}`))
  console.log(`needs manual check (${manual.length}):`)
  manual.forEach((l) => console.log(`  ${l}`))
  console.log(`needs address (${noAddress.length}):`)
  noAddress.forEach((l) => console.log(`  ${l}`))

  if (dry || !filled.length) {
    console.log(dry ? 'dry run: stops.json not changed.' : 'nothing to write.')
    return
  }
  writeFileSync(stopsPath, format(stops))
  console.log('wrote src/data/stops.json. Run npm run check:data and review the diff.')
}

// Keep the repo's layout: one stop per block, fields in type order, 2-space JSON.
const format = (stops: Stop[]) => JSON.stringify(stops, null, 2) + '\n'

main().catch((e: Error) => {
  console.error(`geocode failed: ${e.message}`)
  process.exit(1)
})
