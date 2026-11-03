// Validates src/data/map.json, src/data/stops.json and src/data/cities.json.
// Run: npm run check:data (also runs before every build). --verbose lists every warning.
// Fails (exit 1) on rule violations; warns on missing details, which are expected until verified.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { City, Stop } from '../src/data/types'
import { MAP } from '../src/data/types'

const read = <T>(file: string) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T

const STATUSES = ['open', 'closed', 'unknown']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const HEX = /^#[0-9a-fA-F]{6}$/

const data = read<Stop[]>('src/data/stops.json')
const cities = read<City[]>('src/data/cities.json')
const outline = read<{ fips: string; bounds: { south: number; north: number; west: number; east: number } }>(
  'src/data/outline.json',
)
const errors: string[] = []
const warnings: string[] = []

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === ''
const BOX = outline.bounds
const inBox = (lat: number, lng: number) => lat >= BOX.south && lat <= BOX.north && lng >= BOX.west && lng <= BOX.east

// --- map.json
if (blank(MAP.id)) errors.push('map.json: missing id')
if (blank(MAP.title)) errors.push('map.json: missing title')
if (!/^[A-Z]{2}$/.test(MAP.state)) errors.push('map.json: state must be a 2-letter USPS code')
if (!/^\d{2}$/.test(MAP.fips)) errors.push('map.json: fips must be 2 digits')
if (outline.fips !== MAP.fips) errors.push('outline.json was built for another state: run npm run build:outline')
if (!HEX.test(MAP.accent)) errors.push('map.json: accent must be #rrggbb')
if (!Array.isArray(MAP.credits) || MAP.credits.some(blank)) errors.push('map.json: credits must be non-empty strings')
const regionIds = new Set<string>()
for (const r of MAP.regions) {
  if (blank(r.id) || blank(r.label)) errors.push('map.json: every region needs id and label')
  else if (regionIds.has(r.id)) errors.push(`map.json: duplicate region id "${r.id}"`)
  else regionIds.add(r.id)
}
for (const t of MAP.trademarks ?? []) {
  if (blank(t.term) || blank(t.notice)) errors.push('map.json: every trademark needs term and notice')
  // A registered program name is never this site's name.
  else if (MAP.title.includes(t.term) || MAP.kicker.toUpperCase().includes(t.term.toUpperCase()))
    errors.push(`map.json: title/kicker must not use the trademark "${t.term}"`)
}

// --- cities.json
for (const c of cities) {
  if (blank(c.name)) errors.push('cities.json: missing name')
  if (blank(c.sourceUrl) || !c.sourceUrl.startsWith('https://')) errors.push(`cities.json ${c.name}: sourceUrl must be https`)
  if (!inBox(c.lat, c.lng)) errors.push(`cities.json ${c.name}: outside ${MAP.state}'s bounding box`)
}

// --- stops.json
if (!Array.isArray(data)) errors.push('stops.json must be an array')
const ids = new Set<string>()
data.forEach((d, i) => {
  const at = `#${i + 1} ${d.name ?? '(no name)'}`
  if (blank(d.id)) errors.push(`${at}: missing id`)
  else if (ids.has(d.id)) errors.push(`${at}: duplicate id "${d.id}"`)
  else ids.add(d.id)
  if (d.mapId !== MAP.id) errors.push(`${at}: mapId must be "${MAP.id}" (got "${d.mapId}")`)
  if (d.state !== MAP.state) errors.push(`${at}: state must be "${MAP.state}" (got "${d.state}")`)
  if (blank(d.name)) errors.push(`${at}: missing name`)
  if (blank(d.sourceNote)) errors.push(`${at}: missing sourceNote`)
  if (!STATUSES.includes(d.status)) errors.push(`${at}: status must be open, closed or unknown (got "${d.status}")`)
  if (d.region !== null && !regionIds.has(d.region)) errors.push(`${at}: region must be one of map.json's ids (got "${d.region}")`)
  if (typeof d.toursByAppointment !== 'boolean') errors.push(`${at}: toursByAppointment must be boolean`)

  if (!Array.isArray(d.trails)) errors.push(`${at}: trails must be an array ([] if none)`)
  else {
    if (d.trails.some(blank)) errors.push(`${at}: trails must be non-empty strings`)
    if (new Set(d.trails).size !== d.trails.length) errors.push(`${at}: duplicate trail`)
    if (d.trails.some((t) => /[®™]/.test(t))) errors.push(`${at}: write trail names without ®/™ (the UI adds the mark)`)
  }

  if (d.verifiedOn !== null) {
    if (!DATE.test(d.verifiedOn)) errors.push(`${at}: verifiedOn must be YYYY-MM-DD`)
    if (blank(d.sourceUrl) || !d.sourceUrl!.startsWith('https://'))
      errors.push(`${at}: verifiedOn is set but sourceUrl is missing or not https://`)
  } else {
    warnings.push(`${at}: not verified`)
  }
  if (d.sourceUrl !== null && !d.sourceUrl.startsWith('https://')) errors.push(`${at}: sourceUrl must start with https://`)
  if (d.website !== null && !d.website.startsWith('https://')) warnings.push(`${at}: website is not https`)

  if ((d.lat === null) !== (d.lng === null)) errors.push(`${at}: lat and lng must both be set or both null`)
  if (d.lat !== null && d.lng !== null && !inBox(d.lat, d.lng)) errors.push(`${at}: lat/lng outside ${MAP.state}'s bounding box`)
  if (d.verifiedOn !== null && d.address === null) warnings.push(`${at}: verified but address is null`)
  if (d.verifiedOn !== null && d.lat === null) warnings.push(`${at}: no coordinates yet (no pin)`)
})

const verified = data.filter((d) => d.verifiedOn !== null).length
const pinned = data.filter((d) => d.lat !== null && d.lng !== null).length

if (process.argv.includes('--verbose')) warnings.forEach((w) => console.warn(`warn: ${w}`))
else if (warnings.length) console.warn(`warn: ${warnings.length} warnings (use --verbose to list)`)
errors.forEach((e) => console.error(`error: ${e}`))

console.log(
  `check:data ${MAP.id} | total ${data.length} | on map ${pinned} | verified ${verified} | unverified ${data.length - verified} | cities ${cities.length}`,
)
if (errors.length) {
  console.error(`${errors.length} error(s)`)
  process.exit(1)
}
