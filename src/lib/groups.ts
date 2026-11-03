// Ownership groups and brands, plus the group selection kept in the URL (?groups=a,b).
// Pure helpers; the selection itself is client-side state in Explorer.
import brandsData from '@/data/brands.json'
import groupsData from '@/data/groups.json'
import type { Brand, Group, Stop } from '@/data/types'

export const GROUPS = groupsData as Group[]
export const BRANDS = brandsData as Brand[]
export const ALL_GROUP_IDS = GROUPS.map((g) => g.id)

const BY_ID = new Map(GROUPS.map((g) => [g.id, g]))
export const groupOf = (d: Stop): Group | null => (d.groupId ? (BY_ID.get(d.groupId) ?? null) : null)

export const brandsAt = (stopId: string): Brand[] => BRANDS.filter((b) => b.stopId === stopId)
export const brandsOf = (groupId: string): Brand[] => BRANDS.filter((b) => b.groupId === groupId)

export const URL_PARAM = 'groups'

// Reads ?groups= from a query string. Unknown ids are dropped; nothing valid = all groups (never an empty map).
export function parseGroups(search: string): string[] {
  let raw: string | null = null
  try {
    raw = new URLSearchParams(search).get(URL_PARAM)
  } catch {
    return ALL_GROUP_IDS
  }
  if (!raw) return ALL_GROUP_IDS
  const wanted = new Set(raw.split(',').map((s) => s.trim()))
  const picked = ALL_GROUP_IDS.filter((id) => wanted.has(id)) // keep groups.json order
  return picked.length ? picked : ALL_GROUP_IDS
}

// Writes the selection back to the address bar without a reload. All groups = no parameter.
export function writeGroups(selected: string[]): void {
  try {
    const url = new URL(window.location.href)
    if (selected.length === ALL_GROUP_IDS.length) url.searchParams.delete(URL_PARAM)
    else url.searchParams.set(URL_PARAM, selected.join(','))
    // URLSearchParams encodes commas; keep the readable form (?groups=a,b).
    const href = url.toString().replace(/%2C/gi, ',')
    if (href !== window.location.href) window.history.replaceState(window.history.state, '', href)
  } catch {
    // History API unavailable (very old browser or sandboxed frame): selection still works, just not shareable.
  }
}

// Toggle rules: "All groups" turns every group on; turning off the last group turns them all back on.
export function toggleGroup(selected: string[], id: string): string[] {
  const next = selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id]
  if (next.length === 0) return ALL_GROUP_IDS
  return ALL_GROUP_IDS.filter((g) => next.includes(g))
}

// The URL as an external store for useSyncExternalStore: back/forward (popstate) and our own replaceState
// calls (a custom event, since replaceState fires none) both re-read the query string.
const URL_EVENT = 'groups-url-change'
export function subscribeToUrl(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(URL_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(URL_EVENT, onChange)
  }
}
export const readSearch = (): string => window.location.search
export const notifyUrl = (): void => {
  window.dispatchEvent(new Event(URL_EVENT))
}
