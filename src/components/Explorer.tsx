'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import GroupChips from '@/components/GroupChips'
import GroupMark from '@/components/GroupMark'
import { BrandPills, GroupCompare, GroupPanel } from '@/components/GroupSummary'
import StateMap from '@/components/StateMap'
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
const FIELD =
  'mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-base font-normal normal-case tracking-normal text-text focus-visible:border-amber focus-visible:outline-amber'
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
      {d.status === 'closed' && <span className={`${PILL} border-closed bg-closed text-text`}>Closed</span>}
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
          <BrandPills brands={brandsAt(d.id)} label={`Brands made at ${d.name}`} />
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
  const closed = d.status === 'closed'
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
        {closed && <li className="font-semibold">Closed</li>}
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
  const openList = useMemo(() => visible.filter((d) => d.status !== 'closed'), [visible])
  const closedList = useMemo(() => visible.filter((d) => d.status === 'closed'), [visible])

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
      <GroupChips
        selected={groups}
        onToggle={(id) => setGroups(toggleGroup(groups, id))}
        onAll={() => setGroups(ALL_GROUP_IDS)}
      />
      <StateMap layout={layout} entries={mapped} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      {selected && <DetailPanel d={selected} onClose={closePanel} />}
      {total > 0 && mapped.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          {layout.pins.length === 0 || !filtersActive
            ? 'No distilleries are on the map yet. Every distillery is in the list below.'
            : 'Nothing to show on the map for these filters.'}
        </p>
      )}

      <section aria-labelledby="filters-heading" className="mt-12">
        <h2 id="filters-heading" className="font-display text-3xl font-semibold tracking-tight">
          All distilleries
        </h2>
        {selectedGroups.length === 1 && <GroupPanel group={selectedGroups[0]} entries={entries} />}
        {selectedGroups.length > 1 && !allGroups && <GroupCompare groups={selectedGroups} entries={entries} />}
        {total === 0 ? (
          <div role="status" className="mt-6 rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-display text-xl font-semibold">{EMPTY_MESSAGE}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Search by name
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => update({ query: e.target.value })}
                  className={FIELD}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Region
                <select
                  value={filters.region}
                  onChange={(e) => update({ region: e.target.value })}
                  className={FIELD}
                >
                  <option value="all">All regions</option>
                  {MAP.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
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

            {visible.length === 0 ? (
              <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-center">
                <p className="font-display text-xl font-semibold">No distilleries match</p>
                <button type="button" onClick={reset} className={`${FOCUS_TARGET} mt-3 bg-accent text-text`}>
                  Reset
                </button>
              </div>
            ) : (
              <>
                {openList.length > 0 && <ul className="mt-6 grid gap-3 md:grid-cols-2">{cards(openList)}</ul>}
                {closedList.length > 0 && (
                  <details className="group mt-8 rounded-xl border border-line bg-surface">
                    <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-semibold text-muted hover:text-text">
                      <svg viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden="true">
                        <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Closed ({closedList.length})
                    </summary>
                    <ul className="grid gap-3 border-t border-line p-3 md:grid-cols-2">{cards(closedList)}</ul>
                  </details>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
