'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import GroupMark from '@/components/GroupMark'
import GroupsDropdown, { CONTROL, Chevron, FIELD_TEXT } from '@/components/GroupsDropdown'
import { BrandPills, GroupCompare, GroupPanel } from '@/components/GroupSummary'
import Notice21 from '@/components/Notice21'
import StateMap, { MapKey } from '@/components/StateMap'
import { MAP, type Stop } from '@/data/types'
import {
  ALL_GROUP_IDS,
  GROUPS,
  brandsAt,
  groupOf,
  notifyUrl,
  parseGroups,
  readSearch,
  subscribeToUrl,
  toggleGroup,
  writeGroups,
} from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import { withMarks } from '@/lib/trademarks'

type RegionFilter = 'all' | string
type Filters = { region: RegionFilter; query: string }

const DEFAULT_FILTERS: Filters = { region: 'all', query: '' }

const FOCUS_TARGET = 'min-h-11 rounded-lg px-4 text-sm font-semibold'
const PILL = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const EMPTY_MESSAGE = 'Distilleries are being added and verified.'

function TrailPills({ d }: { d: Stop }) {
  return (
    <>
      {d.trails.map((t) => (
        <span key={t} className={`${PILL} border-amber/60 text-amber`}>
          {withMarks(t)}
        </span>
      ))}
    </>
  )
}

function Badges({ d }: { d: Stop }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <TrailPills d={d} />
      {d.status === 'open' && (
        <span className={`${PILL} border-line text-text`}>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber" />
          Open
        </span>
      )}
      {d.toursByAppointment && <span className={`${PILL} border-accent text-accent-ink`}>Tours by appointment</span>}
    </span>
  )
}

function GroupLine({ d }: { d: Stop }) {
  const group = groupOf(d)
  if (!group) return null
  return (
    <span className="mt-2 flex items-center gap-2 text-sm text-muted">
      <GroupMark group={group} size="sm" />
      Part of {group.name}
      {group.shortName !== group.name && ` (${group.shortName})`}
    </span>
  )
}

function Card({
  d,
  onMap,
  isSelected,
  onSelect,
}: {
  d: Stop
  onMap: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const body = (
    <>
      <Badges d={d} />
      <span className="mt-2 block font-display text-xl leading-snug font-semibold">{d.name}</span>
      <span className="mt-0.5 block text-sm text-muted">{d.city ?? 'Location not yet verified'}</span>
      <GroupLine d={d} />
      {brandsAt(d.id).length > 0 && (
        <span className="mt-2 block">
          <BrandPills brands={brandsAt(d.id)} label={`Brands at ${d.name}`} />
        </span>
      )}
      {(!onMap || !d.verifiedOn) && (
        <span className="mt-2 block text-xs text-muted">
          {[!onMap ? 'Not on map yet' : null, !d.verifiedOn ? 'Details not yet verified' : null].filter(Boolean).join(' · ')}
        </span>
      )}
    </>
  )
  return (
    <li
      className={`overflow-hidden rounded-xl border border-l-4 bg-surface transition-colors focus-within:border-accent hover:border-accent ${
        isSelected ? 'border-line border-l-amber' : 'border-line border-l-transparent'
      }`}
    >
      {onMap ? (
        <button
          type="button"
          aria-expanded={isSelected}
          aria-controls={isSelected ? 'map-panel' : undefined}
          onClick={onSelect}
          className="block min-h-11 w-full px-4 py-4 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="min-h-11 px-4 py-4">{body}</div>
      )}
    </li>
  )
}

function DetailPanel({ d, onClose }: { d: Stop; onClose: () => void }) {
  const showSite = d.website && d.verifiedOn
  return (
    <div
      id="map-panel"
      role="region"
      aria-label={`Details for ${d.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="mt-3 rounded-xl border border-line border-l-4 border-l-amber bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight font-semibold">{d.name}</h2>
          <p className="mt-1 text-sm text-muted">{d.city ?? 'Location not yet verified'}</p>
          <GroupLine d={d} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close details for ${d.name}`}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-line text-xl leading-none text-text hover:border-accent"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {d.trails.map((t) => (
          <li key={t} className="text-amber">
            {withMarks(t)}
          </li>
        ))}
        {d.toursByAppointment && <li className="text-accent-ink">Tours by appointment</li>}
        <li className="text-muted">
          {d.verifiedOn ? `Last verified: ${formatDate(d.verifiedOn)}` : 'Details not yet verified'}
        </li>
      </ul>
      {showSite && (
        <a
          href={d.website!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent hover:text-text"
        >
          Visit website<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  )
}

export default function Explorer({ entries, layout }: { entries: Stop[]; layout: MapLayout }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Ownership groups live in the URL (?groups=), so links are shareable. The static HTML renders all
  // groups (server snapshot); the client then reads the real address bar.
  const search = useSyncExternalStore(subscribeToUrl, readSearch, () => '')
  const groups = useMemo(() => parseGroups(search), [search])
  const setGroups = (next: string[]) => {
    writeGroups(next)
    notifyUrl()
  }

  const total = entries.length
  const allGroups = groups.length === ALL_GROUP_IDS.length

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return entries
      .filter((d) => {
        // Independents (no group) show only while every group is on.
        if (!allGroups && (d.groupId === null || !groups.includes(d.groupId))) return false
        if (filters.region !== 'all' && d.region !== filters.region) return false
        if (q && !d.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  }, [entries, filters, groups, allGroups])

  const pinIds = useMemo(() => new Set(layout.pins.map((p) => p.id)), [layout])
  const mapped = useMemo(() => visible.filter((d) => pinIds.has(d.id)), [visible, pinIds])
  // A selection only counts while its entry is still shown.
  const selected = visible.find((d) => d.id === selectedId && pinIds.has(d.id)) ?? null
  const filtersActive = filters.query.trim() !== '' || filters.region !== 'all' || !allGroups
  const selectedGroups = GROUPS.filter((g) => groups.includes(g.id))

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const reset = () => {
    setFilters(DEFAULT_FILTERS)
    setGroups(ALL_GROUP_IDS)
  }

  const closePanel = () => setSelectedId(null)

  function selectFromList(d: Stop) {
    setSelectedId(selected?.id === d.id ? null : d.id)
  }

  const cards = (list: Stop[]) =>
    list.map((d) => (
      <Card key={d.id} d={d} onMap={pinIds.has(d.id)} isSelected={selected?.id === d.id} onSelect={() => selectFromList(d)} />
    ))

  return (
    <div>
      <StateMap layout={layout} entries={mapped} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      <MapKey showTours={entries.some((d) => d.toursByAppointment && pinIds.has(d.id))} />
      {selected && <DetailPanel d={selected} onClose={closePanel} />}
      {total > 0 && mapped.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          {layout.pins.length === 0 || !filtersActive
            ? 'No distilleries are on the map yet. Every distillery is in the list below.'
            : 'Nothing to show on the map for these filters.'}
        </p>
      )}

      <div className="mt-6">
        <Notice21 quiet />
      </div>

      <section aria-labelledby="filters-heading" className="mt-10">
        <h2 id="filters-heading" className="sr-only">
          Find a distillery
        </h2>
        {total > 0 && (
          <>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 rounded-xl border border-line bg-surface p-2 md:grid-cols-[minmax(0,1fr)_13rem_19rem]">
              <label className="col-span-2 md:col-span-1">
                <span className="sr-only">Search by name</span>
                <input
                  type="search"
                  placeholder="Search by name"
                  value={filters.query}
                  onChange={(e) => update({ query: e.target.value })}
                  className={`${CONTROL} ${FIELD_TEXT}`}
                />
              </label>
              {/* A native select's text can't wrap, so the visible label is a span and the real select sits over it, invisible. */}
              <label className="relative block min-w-0">
                <span className="sr-only">Region</span>
                <select
                  value={filters.region}
                  onChange={(e) => update({ region: e.target.value })}
                  className={`peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 ${FIELD_TEXT}`}
                >
                  <option value="all">Region: All</option>
                  {MAP.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className={`${CONTROL} ${FIELD_TEXT} flex h-full items-center justify-between gap-1.5 leading-tight max-md:px-2.5 peer-hover:border-amber peer-focus-visible:border-amber peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber`}
                >
                  <span className="min-w-0">{MAP.regions.find((r) => r.id === filters.region)?.label ?? 'Region: All'}</span>
                  <Chevron />
                </span>
              </label>
              <GroupsDropdown
                selected={groups}
                onToggle={(id) => setGroups(toggleGroup(groups, id))}
                onAll={() => setGroups(ALL_GROUP_IDS)}
              />
            </div>
            {filtersActive && (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button type="button" onClick={reset} className={`${FOCUS_TARGET} border border-line bg-surface text-amber hover:border-amber`}>
                  Reset
                </button>
                <p role="status" className="text-sm text-muted">
                  Showing {visible.length} of {total}
                </p>
              </div>
            )}
          </>
        )}
        {selectedGroups.length === 1 && <GroupPanel group={selectedGroups[0]} entries={entries} />}
        {selectedGroups.length > 1 && !allGroups && <GroupCompare groups={selectedGroups} entries={entries} />}
        {total === 0 ? (
          <div role="status" className="mt-6 rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-display text-xl font-semibold">{EMPTY_MESSAGE}</p>
          </div>
        ) : (
          <>
            <h2 className="mt-10 font-display text-3xl font-semibold tracking-tight">All distilleries</h2>
            {visible.length === 0 ? (
              <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-center">
                <p className="font-display text-xl font-semibold">No distilleries match</p>
                <button type="button" onClick={reset} className={`${FOCUS_TARGET} mt-3 bg-accent text-text`}>
                  Reset
                </button>
              </div>
            ) : (
              <ul className="mt-6 grid gap-3 md:grid-cols-2">{cards(visible)}</ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
