// Shared record shape for the map family (NC distillery guide, KY bourbon guide, ...).
// Keep compatible with the other guides; note any state-specific field before adding it.
import mapConfig from './map.json'

export type Status = 'open' | 'closed' | 'unknown'
export type Scale = 'major' | 'independent'

export type RegionDef = { id: string; label: string }
export type Trademark = { term: string; notice: string }

// Matches src/data/map.json. `stateName`, `trademarks`, `seoTitle` and `seoDescription` are optional family fields.
export type MapConfig = {
  id: string
  title: string
  kicker: string
  seoTitle?: string // the <title> and social title; falls back to title
  seoDescription?: string // the meta description; falls back to siteDescription()
  state: string // USPS code, e.g. "KY"
  stateName?: string
  fips: string // state FIPS code used by build:outline
  regions: RegionDef[]
  accent: string // hex, becomes --accent
  credits: string[]
  trademarks?: Trademark[]
}

export const MAP: MapConfig = mapConfig

// Matches src/data/groups.json. Ownership groups, sourced from each group's own corporate site.
export type Group = {
  id: string
  name: string
  shortName: string
  marker: string // single capital letter shown on the pin, so colour is never the only cue
  color: string // #rrggbb pin fill; must be >= 4.5:1 against --bg (#0f0d0b)
  hq: string | null
  website: string | null
  ownership: string | null // only what the group's own corporate site states; null = rows show "Part of <name>"
  ownershipSourceUrl: string | null // required (https) when ownership is set
  sourceUrl: string | null // required (https) once verifiedOn is set
  verifiedOn: string | null // YYYY-MM-DD
}

// Matches src/data/brands.json. Brand names are plain text only (no logos, no bottle images).
export type Brand = {
  id: string
  name: string
  groupId: string // must exist in groups.json
  stopId: string | null // a stop where the group's or brand's own site says it is made or offers its visitor experience; else null
  sourceUrl: string | null // required (https) once verifiedOn is set
  verifiedOn: string | null // YYYY-MM-DD
}

// Matches src/data/stops.json exactly. Every fact needs a source and a verifiedOn date.
// `groupId`, `scale` and `geocodeSource` are KY-guide additions to the shared family shape (null = independent / not geocoded).
export type Stop = {
  id: string
  mapId: string // must equal map.json id
  state: string // must equal map.json state
  groupId: string | null // must exist in groups.json when set
  scale: Scale // major requires a groupId; independent requires groupId null
  name: string
  trails: string[] // program names, e.g. ["Kentucky Bourbon Trail"]; [] if none. No ® in data.
  toursByAppointment: boolean
  region: string | null // one of map.json region ids
  city: string | null
  address: string | null
  lat: number | null
  lng: number | null
  geocodeSource: string | null // e.g. "OpenStreetMap Nominatim"; set whenever lat/lng are filled by a geocoder
  phone: string | null
  website: string | null
  hoursNote: string | null
  status: Status
  blurb: string | null
  sourceUrl: string | null // required (https) once verifiedOn is set
  sourceNote: string
  verifiedOn: string | null // YYYY-MM-DD
  note: string | null // renames, mergers, other remarks
}

export type City = {
  name: string
  lat: number
  lng: number
  sourceUrl: string
  label?: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' } // map label offset
}

// Matches src/data/images.json. Only freely licensed photos (public domain, CC0, CC BY), with the credit shown in the footer.
// `licenseUrl` is null when the Commons API gives none (public domain has no license page). localPath is outside public/.
export type ImageRecord = {
  id: string
  title: string // the Commons file title as shown, without the "File:" prefix
  sourceUrl: string // the Commons file page, https
  author: string
  license: string // exact Commons short name, e.g. "Public domain", "CC0", "CC BY 4.0"
  licenseUrl: string | null
  retrievedOn: string // YYYY-MM-DD
  localPath: string // original, downscaled to at most 2400 px wide; not served publicly
}
