'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import GroupMark from '@/components/GroupMark'
import GroupsDropdown, { CONTROL, Chevron, FIELD_TEXT } from '@/components/GroupsDropdown'
import { BrandPills, GroupCompare, GroupPanel } from '@/components/GroupSummary'
import Notice21 from '@/components/Notice21'
import StateMap, { MapKey } from '@/components/StateMap'
import { MAP, type Stop } from '@/data/types'
import {
  ALL_GROUP_IDS,
  ALL_REGIONS,
  GROUPS,
  brandsAt,
  groupOf,
  notifyUrl,
  parseGroups,
  parseRegion,
  readSearch,
  subscribeToUrl,
  toggleGroup,
  writeGroups,
  writeRegion,
} from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import { withMarks } from '@/lib/trademarks'

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

const directionsUrl = (d: Stop) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${d.address}`)}`

const CARD_LINK =
  'inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-accent-ink transition-colors hover:border-accent'
const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>

// Shown under the card's button when it is expanded. Links can't sit inside a button, so this is its sibling.
function CardDetails({ d, onMap, onShowOnMap }: { d: Stop; onMap: boolean; onShowOnMap: () => void }) {
  const brands = brandsAt(d.id)
  return (
    <div id={`card-${d.id}-details`} className="space-y-3 border-t border-line px-4 pt-3 pb-4 text-sm">
      {d.blurb && <p className="text-text">{d.blurb}</p>}
      {d.address && <p className="text-text">{d.address}</p>}
      {d.hoursNote && <p className="text-muted">{d.hoursNote}</p>}
      {brands.length > 0 && <BrandPills brands={brands} label={`Brands at ${d.name}`} />}
      <div className="flex flex-wrap items-center gap-2">
        {onMap ? (
          <button
            type="button"
            onClick={onShowOnMap}
            className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-text transition-colors hover:bg-accent/80"
          >
            Show on map
          </button>
        ) : (
          <p className="flex min-h-11 items-center pr-2 text-muted">Not on the map yet</p>
        )}
        {d.address && (
          <a href={directionsUrl(d)} target="_blank" rel="noopener" className={CARD_LINK}>
            Directions{NEW_TAB}
          </a>
        )}
        {d.website && (
          <a href={d.website} target="_blank" rel="noopener" className={CARD_LINK}>
            Website{NEW_TAB}
          </a>
        )}
        {d.phone && (
          <a href={`tel:${d.phone.replace(/[^\d+]/g, '')}`} className={`${CARD_LINK} tabular`}>
            {d.phone}
          </a>
        )}
      </div>
      {d.verifiedOn && (
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <span>Last verified: {formatDate(d.verifiedOn)}</span>
          {d.sourceUrl && (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={d.sourceUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center px-1 text-accent-ink underline underline-offset-2"
              >
                Source{NEW_TAB}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function Card({
  d,
  onMap,
  isExpanded,
  onToggle,
  onShowOnMap,
}: {
  d: Stop
  onMap: boolean
  isExpanded: boolean
  onToggle: () => void
  onShowOnMap: () => void
}) {
  const color = groupOf(d)?.color
  // Hover and focus styles belong to the button alone: nothing else in a card should look clickable.
  return (
    <li
      id={`card-${d.id}`}
      className="scroll-mt-4 rounded-xl border border-l-4 border-line bg-surface"
      style={{ borderLeftColor: isExpanded ? (color ?? 'var(--amber)') : 'transparent' }}
    >
      <button
        id={`card-${d.id}-button`}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? `card-${d.id}-details` : undefined}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start justify-between gap-3 rounded-[inherit] p-4 text-left transition-colors hover:bg-raised focus-visible:bg-raised"
      >
        <span className="min-w-0">
          <Badges d={d} />
          <span className="mt-2 block font-display text-xl leading-snug font-semibold">{d.name}</span>
          <span className="mt-0.5 block text-sm text-muted">{d.city ?? 'Location not yet verified'}</span>
          <GroupLine d={d} />
          {((!onMap && !isExpanded) || !d.verifiedOn) && (
            <span className="mt-2 block text-xs text-muted">
              {[!onMap && !isExpanded ? 'Not on the map yet' : null, !d.verifiedOn ? 'Details not yet verified' : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
        <Chevron className={`mt-1 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && <CardDetails d={d} onMap={onMap} onShowOnMap={onShowOnMap} />}
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
  const [query, setQuery] = useState('')
  // A region change only animates after the visitor has made one; a ?region= link opens already zoomed.
  const [regionTouched, setRegionTouched] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // A scroll to run once the page has rendered the change that asked for it. Always a new object, so repeating one works.
  const [jump, setJump] = useState<{ to: 'map' | 'card'; id: string } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  // Ownership groups and the region live in the URL (?groups=, ?region=), so links are shareable. The static HTML renders all
  // groups (server snapshot); the client then reads the real address bar.
  const search = useSyncExternalStore(subscribeToUrl, readSearch, () => '')
  const groups = useMemo(() => parseGroups(search), [search])
  const region = useMemo(() => parseRegion(search), [search])
  const setGroups = (next: string[]) => {
    writeGroups(next)
    notifyUrl()
  }
  const setRegion = (id: string) => {
    setRegionTouched(true)
    writeRegion(id)
    notifyUrl()
  }

  const total = entries.length
  const allGroups = groups.length === ALL_GROUP_IDS.length

  // Everything the group and search filters allow, before the region narrows it.
  const inScope = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((d) => {
      // Independents (no group) show only while every group is on.
      if (!allGroups && (d.groupId === null || !groups.includes(d.groupId))) return false
      if (q && !d.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, query, groups, allGroups])
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of inScope) if (d.region) counts[d.region] = (counts[d.region] ?? 0) + 1
    return counts
  }, [inScope])
  const visible = useMemo(
    () =>
      inScope
        .filter((d) => region === ALL_REGIONS || d.region === region)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    [inScope, region],
  )

  const pinIds = useMemo(() => new Set(layout.pins.map((p) => p.id)), [layout])
  const mapped = useMemo(() => visible.filter((d) => pinIds.has(d.id)), [visible, pinIds])
  // A selection or an open card only counts while its entry is still shown.
  const selected = visible.find((d) => d.id === selectedId && pinIds.has(d.id)) ?? null
  const expanded = visible.find((d) => d.id === expandedId)?.id ?? null
  const filtersActive = query.trim() !== '' || region !== ALL_REGIONS || !allGroups
  const selectedGroups = GROUPS.filter((g) => groups.includes(g.id))

  const reset = () => {
    setQuery('')
    setRegion(ALL_REGIONS)
    setGroups(ALL_GROUP_IDS)
  }

  const closePanel = () => setSelectedId(null)

  // The open card and the selected pin stay linked: leaving a card also clears its pin and panel.
  function toggleCard(id: string) {
    const opening = expanded !== id
    setExpandedId(opening ? id : null)
    if (selected?.id !== id || !opening) setSelectedId(null)
  }

  function showOnMap(d: Stop) {
    setSelectedId(d.id)
    if (d.region) setRegion(d.region)
    setJump({ to: 'map', id: d.id })
  }

  function selectPin(id: string) {
    setSelectedId(id)
    setExpandedId(id)
    setJump({ to: 'card', id })
  }

  useEffect(() => {
    if (!jump) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    if (jump.to === 'map') {
      mapRef.current?.scrollIntoView({ behavior, block: 'start' })
      // The pin is now the thing in view, so keyboard users continue from there.
      mapRef.current?.querySelector<SVGGElement>(`[data-pin="${jump.id}"]`)?.focus({ preventScroll: true })
    } else {
      document.getElementById(`card-${jump.id}`)?.scrollIntoView({ behavior, block: 'start' })
    }
  }, [jump])

  // Escape collapses the open card and leaves focus on it. Only from the card, its pin or nowhere in particular:
  // the groups menu and the pin's panel have their own Escape, and a search field should keep its focus.
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const card = document.getElementById(`card-${expanded}`)
      const target = e.target instanceof Element ? e.target : null
      if (target && target !== document.body && !card?.contains(target) && !target.closest('.dg-pin')) return
      setExpandedId(null)
      setSelectedId(null)
      document.getElementById(`card-${expanded}-button`)?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  const cards = (list: Stop[]) =>
    list.map((d) => (
      <Card
        key={d.id}
        d={d}
        onMap={pinIds.has(d.id)}
        isExpanded={expanded === d.id}
        onToggle={() => toggleCard(d.id)}
        onShowOnMap={() => showOnMap(d)}
      />
    ))

  return (
    <div>
      <div ref={mapRef} className="scroll-mt-4">
        <StateMap
          layout={layout}
          entries={mapped}
          selectedId={selected?.id ?? null}
          onSelect={selectPin}
          regionId={region}
          regionCounts={regionCounts}
          onRegion={setRegion}
          animate={regionTouched}
        />
      </div>
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${CONTROL} ${FIELD_TEXT}`}
                />
              </label>
              {/* A native select's text can't wrap, so the visible label is a span and the real select sits over it, invisible. */}
              <label className="relative block min-w-0">
                <span className="sr-only">Region</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={`peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 ${FIELD_TEXT}`}
                >
                  <option value={ALL_REGIONS}>Region: All</option>
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
                  <span className="min-w-0">{MAP.regions.find((r) => r.id === region)?.label ?? 'Region: All'}</span>
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
              <ul className="mt-6 grid items-start gap-3 md:grid-cols-2">{cards(visible)}</ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
