// Validates src/data/map.json, stops.json, groups.json, brands.json and cities.json.
// Run: npm run check:data (also runs before every build). --verbose lists every warning.
// Fails (exit 1) on rule violations; warns on missing details, which are expected until verified.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Brand, City, Group, ImageRecord, Stop } from '../src/data/types'
import { existsSync } from 'node:fs'
import { MAP } from '../src/data/types'
import { computeRegions, regionProblems, type RegionArea } from '../src/lib/regions'
import { contrast, readTokens, textPairs } from './contrast'

const read = <T>(file: string) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T

const STATUSES = ['open', 'closed', 'unknown']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const HEX = /^#[0-9a-fA-F]{6}$/

const data = read<Stop[]>('src/data/stops.json')
const groups = read<Group[]>('src/data/groups.json')
const brands = read<Brand[]>('src/data/brands.json')
const cities = read<City[]>('src/data/cities.json')
const images = read<ImageRecord[]>('src/data/images.json')
const savedRegions = read<RegionArea[]>('src/data/regions.json')
const outline = read<{ fips: string; width: number; height: number; bounds: { south: number; north: number; west: number; east: number } }>(
  'src/data/outline.json',
)
const errors: string[] = []
const warnings: string[] = []

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === ''
const BOX = outline.bounds
// The tokens are defined once, in globals.css; every text pair in use must pass AA (npm run check:contrast prints them).
const TOKENS = readTokens()
for (const p of textPairs(TOKENS)) {
  const c = contrast(p.fg, p.bg)
  if (c < 4.5) errors.push(`contrast: ${p.name} is ${c.toFixed(2)}:1; AA needs 4.5:1`)
}
// Shared source rule: an https sourceUrl is required once verifiedOn is set.
function checkSource(at: string, rec: { sourceUrl: string | null; verifiedOn: string | null }) {
  if (rec.verifiedOn !== null) {
    if (!DATE.test(rec.verifiedOn)) errors.push(`${at}: verifiedOn must be YYYY-MM-DD`)
    if (blank(rec.sourceUrl) || !rec.sourceUrl!.startsWith('https://'))
      errors.push(`${at}: verifiedOn is set but sourceUrl is missing or not https://`)
  }
  if (rec.sourceUrl !== null && !rec.sourceUrl.startsWith('https://')) errors.push(`${at}: sourceUrl must start with https://`)
}
const inBox = (lat: number, lng: number) => lat >= BOX.south && lat <= BOX.north && lng >= BOX.west && lng <= BOX.east

// --- map.json
if (blank(MAP.id)) errors.push('map.json: missing id')
if (blank(MAP.title)) errors.push('map.json: missing title')
if (!/^[A-Z]{2}$/.test(MAP.state)) errors.push('map.json: state must be a 2-letter USPS code')
if (!/^\d{2}$/.test(MAP.fips)) errors.push('map.json: fips must be 2 digits')
if (outline.fips !== MAP.fips) errors.push('outline.json was built for another state: run npm run build:outline')
if (!HEX.test(MAP.accent)) errors.push('map.json: accent must be #rrggbb')
if (MAP.accent.toLowerCase() !== TOKENS['--wine'].toLowerCase()) errors.push('map.json: accent must equal --wine in globals.css (icons and theme colour read it)')
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

// --- images.json: only freely licensed photos, each fully recorded (the footer credit reads this)
const FREE_LICENSE = /^(public domain|cc0( 1\.0)?|cc by(-sa)?( \d\.\d)?)$/i // CC BY-NC and -ND do not match
const IMAGE_FIELDS = ['id', 'title', 'sourceUrl', 'author', 'license', 'retrievedOn', 'localPath'] as const
for (const im of images) {
  const at = `images.json ${im.id ?? '(no id)'}`
  for (const k of IMAGE_FIELDS) if (blank(im[k])) errors.push(`${at}: missing ${k}`)
  if (!('licenseUrl' in im)) errors.push(`${at}: missing licenseUrl (use null when the API gives none)`)
  else if (im.licenseUrl !== null && (blank(im.licenseUrl) || !im.licenseUrl.startsWith('https://'))) errors.push(`${at}: licenseUrl must be https or null`)
  if (!blank(im.license) && !FREE_LICENSE.test(im.license.trim())) errors.push(`${at}: license "${im.license}" is not public domain, CC0, CC BY or CC BY-SA`)
  if (!blank(im.sourceUrl) && !im.sourceUrl.startsWith('https://')) errors.push(`${at}: sourceUrl must start with https://`)
  if (!blank(im.retrievedOn) && !DATE.test(im.retrievedOn)) errors.push(`${at}: retrievedOn must be YYYY-MM-DD`)
  if (!blank(im.localPath) && !existsSync(join(process.cwd(), im.localPath))) errors.push(`${at}: localPath ${im.localPath} does not exist`)
}

// --- groups.json
const groupIds = new Set<string>()
const markers = new Set<string>()
for (const g of groups) {
  const at = `groups.json ${g.id ?? '(no id)'}`
  if (blank(g.id)) errors.push(`${at}: missing id`)
  else if (groupIds.has(g.id)) errors.push(`${at}: duplicate id`)
  else groupIds.add(g.id)
  if (blank(g.name) || blank(g.shortName)) errors.push(`${at}: needs name and shortName`)
  if (!/^[A-Z]$/.test(g.marker)) errors.push(`${at}: marker must be one capital letter`)
  else if (markers.has(g.marker)) errors.push(`${at}: duplicate marker "${g.marker}"`)
  else markers.add(g.marker)
  if (!HEX.test(g.color)) errors.push(`${at}: color must be #rrggbb`)
  else
    if (contrast(g.color, TOKENS['--wine-deep']) < 4.5)
      errors.push(`${at}: color ${g.color} is ${contrast(g.color, TOKENS['--wine-deep']).toFixed(2)}:1 on --wine-deep; AA needs 4.5:1`)
  if (g.website !== null && !g.website.startsWith('https://')) errors.push(`${at}: website must be https`)
  if (g.ownership !== null && (blank(g.ownership) || blank(g.ownershipSourceUrl) || !g.ownershipSourceUrl!.startsWith('https://')))
    errors.push(`${at}: ownership needs an https ownershipSourceUrl`)
  if (g.ownership === null && g.ownershipSourceUrl !== null) errors.push(`${at}: ownershipSourceUrl without ownership`)
  checkSource(at, g)
  if (g.verifiedOn === null) warnings.push(`${at}: not verified`)
}
const groupColors = groups.map((g) => g.color.toLowerCase())
if (new Set(groupColors).size !== groupColors.length) errors.push('groups.json: colors must be distinct')

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
  if (d.groupId === undefined) errors.push(`${at}: groupId is required (null for independents)`)
  else if (d.groupId !== null && !groupIds.has(d.groupId)) errors.push(`${at}: unknown groupId "${d.groupId}"`)
  if (d.scale !== 'major' && d.scale !== 'independent') errors.push(`${at}: scale must be major or independent (got "${d.scale}")`)
  if (d.scale === 'major' && d.groupId === null) errors.push(`${at}: scale major requires a groupId`)
  if (d.scale === 'independent' && d.groupId !== null) errors.push(`${at}: scale independent requires groupId null`)
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

  checkSource(at, d)
  if (d.verifiedOn === null) warnings.push(`${at}: not verified`)
  if (d.website !== null && !d.website.startsWith('https://')) warnings.push(`${at}: website is not https`)
  if (d.instagram != null && !/^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/.test(d.instagram)) errors.push(`${at}: instagram must be https://www.instagram.com/<handle>/`)

  if ((d.lat === null) !== (d.lng === null)) errors.push(`${at}: lat and lng must both be set or both null`)
  if (d.lat !== null && d.lng !== null && !inBox(d.lat, d.lng)) errors.push(`${at}: lat/lng outside ${MAP.state}'s bounding box`)
  if (d.lat !== null && !d.geocodeSource) errors.push(`${at}: geocodeSource is required once lat/lng are set`)
  if (d.verifiedOn !== null && d.address === null) warnings.push(`${at}: verified but address is null`)
  if (d.verifiedOn !== null && d.lat === null) warnings.push(`${at}: no coordinates yet (no pin)`)
})

// --- regions.json (generated from pins, so it can only go stale)
if (JSON.stringify(savedRegions) !== JSON.stringify(computeRegions(data, outline.width, outline.height)))
  errors.push('regions.json is out of date: run npm run build:regions')
errors.push(...regionProblems(savedRegions))

// --- brands.json
const brandIds = new Set<string>()
for (const b of brands) {
  const at = `brands.json ${b.id ?? '(no id)'}`
  if (blank(b.id)) errors.push(`${at}: missing id`)
  else if (brandIds.has(b.id)) errors.push(`${at}: duplicate id`)
  else brandIds.add(b.id)
  if (blank(b.name)) errors.push(`${at}: missing name`)
  if (b.groupId === null) {
    // A brand with no group belongs to an independent's stop.
    const stop = b.stopId === null ? undefined : data.find((d) => d.id === b.stopId)
    if (!stop) errors.push(`${at}: groupId is null, so stopId must name an existing stop`)
    else if (stop.scale !== 'independent') errors.push(`${at}: groupId is null but stop ${stop.id} is not an independent`)
  } else {
    if (!groupIds.has(b.groupId)) errors.push(`${at}: unknown groupId "${b.groupId}"`)
    const stop = b.stopId === null ? undefined : data.find((d) => d.id === b.stopId)
    if (stop && stop.groupId !== b.groupId) errors.push(`${at}: stop ${stop.id} belongs to another group`)
  }
  if (b.stopId !== null && !ids.has(b.stopId)) errors.push(`${at}: unknown stopId "${b.stopId}"`)
  checkSource(at, b)
  if (b.verifiedOn === null) warnings.push(`${at}: not verified`)
}

const verified = data.filter((d) => d.verifiedOn !== null).length
// Closed stops are validated like any other but never shown to visitors (src/lib/stops.ts).
const closedStops = data.filter((d) => d.status === 'closed')
const pinned = data.filter((d) => d.lat !== null && d.lng !== null).length

if (process.argv.includes('--verbose')) warnings.forEach((w) => console.warn(`warn: ${w}`))
else if (warnings.length) console.warn(`warn: ${warnings.length} warnings (use --verbose to list)`)
errors.forEach((e) => console.error(`error: ${e}`))

console.log(
  `check:data ${MAP.id} | total ${data.length} | on map ${pinned} | verified ${verified} | unverified ${data.length - verified} | closed (hidden) ${closedStops.length} | cities ${cities.length}`,
)
closedStops.forEach((d) => console.log(`  closed, hidden from visitors (keep in data, don't re-add): ${d.id}`))
for (const g of groups) {
  const s = data.filter((d) => d.groupId === g.id).length
  const b = brands.filter((x) => x.groupId === g.id).length
  console.log(`  ${g.marker} ${g.name.padEnd(24)} stops ${s} | brands ${b}`)
}
const independents = data.filter((d) => d.groupId === null).length
if (independents) console.log(`    Independent              stops ${independents}`)
if (errors.length) {
  console.error(`${errors.length} error(s)`)
  process.exit(1)
}
