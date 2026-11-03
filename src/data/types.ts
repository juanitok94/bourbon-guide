// Shared record shape for the map family (NC distillery guide, KY bourbon guide, ...).
// Keep compatible with the other guides; note any state-specific field before adding it.
import mapConfig from './map.json'

export type Status = 'open' | 'closed' | 'unknown'

export type RegionDef = { id: string; label: string }
export type Trademark = { term: string; notice: string }

// Matches src/data/map.json. `stateName` and `trademarks` are optional family fields.
export type MapConfig = {
  id: string
  title: string
  kicker: string
  state: string // USPS code, e.g. "KY"
  stateName?: string
  fips: string // state FIPS code used by build:outline
  regions: RegionDef[]
  accent: string // hex, becomes --accent
  credits: string[]
  trademarks?: Trademark[]
}

export const MAP: MapConfig = mapConfig

// Matches src/data/stops.json exactly. Every fact needs a source and a verifiedOn date.
export type Stop = {
  id: string
  mapId: string // must equal map.json id
  state: string // must equal map.json state
  name: string
  trails: string[] // program names, e.g. ["Kentucky Bourbon Trail"]; [] if none. No ® in data.
  toursByAppointment: boolean
  region: string | null // one of map.json region ids
  city: string | null
  address: string | null
  lat: number | null
  lng: number | null
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
