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
  ALL_TRAILS,
  BRANDS,
  GROUPS,
  SHOW_OPTIONS,
  brandsAt,
  groupOf,
  notifyUrl,
  ownershipLine,
  parseGroups,
  parseRegion,
  parseShow,
  parseTrail,
  readSearch,
  subscribeToUrl,
  toggleGroup,
  writeGroups,
  writeRegion,
  writeShow,
  writeTrail,
  type Show,
} from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import { withMarks } from '@/lib/trademarks'

const PILL = 'inline-flex items-center border border-gold/60 px-2 py-0.5 text-xs text-cream'
const TEXT_BUTTON = 'min-h-11 border-[1.5px] border-gold px-4 text-sm text-gold transition-colors hover:bg-wine-deep'
const EMPTY_MESSAGE = 'Distilleries are being added and verified.'
const NO_INDEPENDENTS = 'Independent distilleries are being added and verified.'

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

const directionsUrl = (d: Stop) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${d.address}`)}`

const ROW_LINK = 'inline-flex min-h-11 items-center border border-gold px-4 text-sm text-gold transition-colors hover:bg-wine-deep'
const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>

// Shown under the row's button when it is expanded. Links can't sit inside a button, so this is its sibling.
function RowDetails({ d, onMap, onShowOnMap }: { d: Stop; onMap: boolean; onShowOnMap: () => void }) {
  const brands = brandsAt(d.id)
  return (
    <div id={`card-${d.id}-details`} className="space-y-3 pt-1 pb-4 pl-9 text-sm">
      {d.blurb && <p>{d.blurb}</p>}
      {d.address && <p>{d.address}</p>}
      {d.hoursNote && <p className="text-muted">{d.hoursNote}</p>}
      <ul aria-label={`About ${d.name}`} className="flex flex-wrap gap-1.5">
        {d.status === 'open' && <li className={PILL}>Open</li>}
        {d.toursByAppointment && <li className={PILL}>Tours by appointment</li>}
        {d.trails.map((t) => (
          <li key={t} className={PILL}>
            {withMarks(t)}
          </li>
        ))}
      </ul>
      {brands.length > 0 && <BrandPills brands={brands} label={`Brands at ${d.name}`} />}
      <div className="flex flex-wrap items-center gap-2">
        {onMap ? (
          <button type="button" onClick={onShowOnMap} className="min-h-11 bg-gold px-4 text-sm font-semibold text-wine transition-colors hover:bg-cream">
            Show on map
          </button>
        ) : (
          <p className="flex min-h-11 items-center pr-2 text-muted">Not on the map yet</p>
        )}
        {d.address && (
          <a href={directionsUrl(d)} target="_blank" rel="noopener" className={ROW_LINK}>
            Directions{NEW_TAB}
          </a>
        )}
        {d.website && (
          <a href={d.website} target="_blank" rel="noopener" className={ROW_LINK}>
            Website{NEW_TAB}
          </a>
        )}
        {d.instagram && (
          <a href={d.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${d.name} on Instagram`} className={ROW_LINK}>
            Instagram @{d.instagram.split('/')[3]}
            {NEW_TAB}
          </a>
        )}
        {d.phone && (
          <a href={`tel:${d.phone.replace(/[^\d+]/g, '')}`} className={`${ROW_LINK} tabular`}>
            {d.phone}
          </a>
        )}
      </div>
      {d.verifiedOn ? (
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <span>Last verified: {formatDate(d.verifiedOn)}</span>
          {d.sourceUrl && (
            <>
              <span aria-hidden="true">·</span>
              <a href={d.sourceUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center px-1 text-gold underline underline-offset-2">
                Source{NEW_TAB}
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="text-xs text-muted">Details not yet verified</p>
      )}
    </div>
  )
}

function Row({
  d,
  number,
  brandNote,
  onMap,
  isExpanded,
  isHighlighted,
  onToggle,
  onShowOnMap,
}: {
  d: Stop
  number: number
  brandNote: string | null
  onMap: boolean
  isExpanded: boolean
  isHighlighted: boolean
  onToggle: () => void
  onShowOnMap: () => void
}) {
  const group = groupOf(d)
  const city = d.city ?? 'Location not yet verified'
  const details = d.scale === 'major' && group ? [ownershipLine(group)] : d.trails.map(withMarks)
  return (
    <li id={`card-${d.id}`} data-highlighted={isHighlighted || undefined} className="dg-row scroll-mt-4">
      <button
        id={`card-${d.id}-button`}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? `card-${d.id}-details` : undefined}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-wine-deep/50"
      >
        <span aria-hidden="true" className="flex w-6 shrink-0 justify-center">
          {group ? <GroupMark group={group} /> : <span className="dg-dot" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-lg leading-snug font-semibold">{d.name}</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-muted">
            {[city, ...details].join(' · ')}
          </span>
          {brandNote && <span className="mt-0.5 block text-[10px] leading-snug text-gold">Brand: {brandNote}</span>}
        </span>
        <span className="tabular shrink-0 pl-2 text-xs text-muted">{String(number).padStart(2, '0')}</span>
      </button>
      {isExpanded && <RowDetails d={d} onMap={onMap} onShowOnMap={onShowOnMap} />}
    </li>
  )
}

// A native select's text can't wrap, so the visible label is a span and the real select sits over it, invisible.
function SelectControl({
  label,
  value,
  allValue,
  allOption,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: string
  allValue: string
  allOption: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 ${FIELD_TEXT}`}
      >
        <option value={allValue}>{allOption}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className={`${CONTROL} flex h-full items-center justify-between gap-1.5 text-sm leading-tight peer-hover:bg-wine-deep peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold`}
      >
        <span className="min-w-0">{options.find((o) => o.id === value)?.label ?? label}</span>
        <Chevron />
      </span>
    </label>
  )
}

function LayerSwitch({ show, onChange }: { show: Show; onChange: (next: Show) => void }) {
  return (
    <div role="radiogroup" aria-label="Which distilleries to show" className="grid grid-cols-3 border-[1.5px] border-gold">
      {SHOW_OPTIONS.map((o) => (
        <label key={o.id} className="relative block min-w-0 cursor-pointer">
          <input
            type="radio"
            name="show"
            value={o.id}
            checked={show === o.id}
            onChange={() => onChange(o.id)}
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none"
          />
          <span className="flex min-h-11 items-center justify-center text-xs text-cream transition-colors peer-checked:bg-gold peer-checked:font-semibold peer-checked:text-wine peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold sm:text-sm">
            {o.label}
          </span>
        </label>
      ))}
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
  // The view, groups, region and trail live in the URL, so links are shareable. The static HTML renders the defaults
  // (server snapshot); the client then reads the real address bar.
  const search = useSyncExternalStore(subscribeToUrl, readSearch, () => '')
  const show = useMemo(() => parseShow(search), [search])
  const groups = useMemo(() => parseGroups(search), [search])
  const region = useMemo(() => parseRegion(search), [search])
  const trailParam = useMemo(() => parseTrail(search), [search])
  const setShow = (next: Show) => {
    writeShow(next)
    notifyUrl()
  }
  const setGroups = (next: string[]) => {
    writeGroups(next)
    notifyUrl()
  }
  const setRegion = (id: string) => {
    setRegionTouched(true)
    writeRegion(id)
    notifyUrl()
  }
  const setTrail = (id: string) => {
    writeTrail(id)
    notifyUrl()
  }

  // The stops in the current view, before any filter. The stats line and "of N" count these.
  const layer = useMemo(
    () => (show === 'all' ? entries : entries.filter((d) => (show === 'majors' ? d.scale === 'major' : d.scale === 'independent'))),
    [entries, show],
  )
  const hasMajors = layer.some((d) => d.scale === 'major')
  const groupsInView = new Set(layer.map((d) => d.groupId).filter(Boolean)).size
  const showGroups = show !== 'independents'
  const trailOptions = useMemo(
    () => (show === 'majors' ? [] : [...new Set(layer.flatMap((d) => d.trails))].sort((a, b) => a.localeCompare(b))),
    [layer, show],
  )
  const trail = trailOptions.includes(trailParam) ? trailParam : ALL_TRAILS
  const allGroups = groups.length === ALL_GROUP_IDS.length

  // For each stop, the brands a search hit. Only brands tied to a stop can lead to one.
  const q = query.trim().toLowerCase()
  const brandHits = useMemo(() => {
    const hits = new Map<string, string[]>()
    if (!q) return hits
    for (const b of BRANDS) {
      if (b.stopId && b.name.toLowerCase().includes(q)) hits.set(b.stopId, [...(hits.get(b.stopId) ?? []), b.name])
    }
    return hits
  }, [q])

  // Everything the group, trail and search filters allow, before the region narrows it.
  const inScope = useMemo(() => {
    return layer.filter((d) => {
      // Groups apply to Majors only: an independent has no group to filter by.
      if (d.scale === 'major' && (d.groupId === null || !groups.includes(d.groupId))) return false
      if (trail !== ALL_TRAILS && !d.trails.includes(trail)) return false
      if (q && !d.name.toLowerCase().includes(q) && !(d.city ?? '').toLowerCase().includes(q) && !brandHits.has(d.id)) return false
      return true
    })
  }, [layer, groups, trail, q, brandHits])
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
  // A selection or an open row only counts while its entry is still shown.
  const selected = visible.find((d) => d.id === selectedId && pinIds.has(d.id)) ?? null
  const expanded = visible.find((d) => d.id === expandedId)?.id ?? null
  const filtersActive = q !== '' || region !== ALL_REGIONS || (showGroups && !allGroups) || trail !== ALL_TRAILS
  const selectedGroups = GROUPS.filter((g) => groups.includes(g.id))

  const reset = () => {
    setQuery('')
    setRegion(ALL_REGIONS)
    setGroups(ALL_GROUP_IDS)
    setTrail(ALL_TRAILS)
  }

  // The open row and the selected pin stay linked: leaving a row also clears its pin.
  function toggleRow(id: string) {
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
      // The row is now the thing in view, so keyboard users continue from there.
      document.getElementById(`card-${jump.id}-button`)?.focus({ preventScroll: true })
    }
  }, [jump])

  // Escape collapses the open row and leaves focus on it. Only from the row, its pin or nowhere in particular:
  // the groups menu has its own Escape, and a search field should keep its focus.
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const row = document.getElementById(`card-${expanded}`)
      const target = e.target instanceof Element ? e.target : null
      if (target && target !== document.body && !row?.contains(target) && !target.closest('.dg-pin')) return
      setExpandedId(null)
      setSelectedId(null)
      document.getElementById(`card-${expanded}-button`)?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  const trailControl = trailOptions.length > 0 && (
    <SelectControl
      label="Trail"
      value={trail}
      allValue={ALL_TRAILS}
      allOption="All trails"
      options={trailOptions.map((t) => ({ id: t, label: withMarks(t) }))}
      onChange={setTrail}
    />
  )
  const groupsControl = (
    <GroupsDropdown selected={groups} onToggle={(id) => setGroups(toggleGroup(groups, id))} onAll={() => setGroups(ALL_GROUP_IDS)} />
  )
  // Region spans the row when it has no partner. In All view Groups is a third control on its own full-width row on
  // phones, and shares one row with the others on wider screens.
  const regionSpans = show === 'independents' && trailOptions.length === 0
  const threeControls = show === 'all' && trailOptions.length > 0
  const regionControl = (
    <SelectControl
      label="Region"
      value={region}
      allValue={ALL_REGIONS}
      allOption="All regions"
      options={MAP.regions}
      onChange={setRegion}
      className={regionSpans ? 'col-span-2' : ''}
    />
  )

  return (
    <div>
      <p className="tabular text-center text-xs text-muted">
        {layer.length} in view
        {hasMajors && ` · ${groupsInView} ${groupsInView === 1 ? 'group' : 'groups'}`}
      </p>

      <div ref={mapRef} className="mt-6 scroll-mt-4">
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
      {show !== 'independents' && <MapKey />}
      {layer.length > 0 && mapped.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          {layout.pins.length === 0 || !filtersActive
            ? 'No distilleries are on the map yet. Every distillery is in the list below.'
            : 'Nothing to show on the map for these filters.'}
        </p>
      )}
      <div className="mt-3">
        <Notice21 quiet />
      </div>

      <section aria-labelledby="filters-heading" className="mt-6">
        <h2 id="filters-heading" className="sr-only">
          Find a distillery
        </h2>
        <LayerSwitch show={show} onChange={setShow} />

        {entries.length > 0 && (
          <div className="mt-4 space-y-2">
            {layer.length > 0 && (
              <label className="block">
                <span className="sr-only">Find a brand or distillery</span>
                <input
                  type="search"
                  placeholder="Find a brand or distillery"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${CONTROL} ${FIELD_TEXT}`}
                />
              </label>
            )}
            <div className={`grid grid-cols-2 gap-2 ${threeControls ? 'md:grid-cols-3' : ''}`}>
              {show === 'majors' ? (
                <>
                  {groupsControl}
                  {regionControl}
                </>
              ) : (
                <>
                  {regionControl}
                  {trailControl}
                  {show === 'all' && <div className={threeControls ? 'col-span-2 md:col-span-1' : ''}>{groupsControl}</div>}
                </>
              )}
            </div>
            {filtersActive && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button type="button" onClick={reset} className={TEXT_BUTTON}>
                  Reset
                </button>
                <p role="status" className="text-xs text-muted">
                  Showing {visible.length} of {layer.length}
                </p>
              </div>
            )}
          </div>
        )}

        {showGroups && selectedGroups.length === 1 && <GroupPanel group={selectedGroups[0]} entries={entries} />}
        {showGroups && selectedGroups.length > 1 && !allGroups && <GroupCompare groups={selectedGroups} entries={entries} />}

        {entries.length === 0 || layer.length === 0 ? (
          <div role="status" className="dg-ruled mt-8 py-6 text-center">
            <p className="font-serif text-xl font-semibold">{entries.length === 0 ? EMPTY_MESSAGE : NO_INDEPENDENTS}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="dg-ruled mt-6 py-6 text-center">
            <p className="font-serif text-xl font-semibold">No distilleries match</p>
            <button type="button" onClick={reset} className={`${TEXT_BUTTON} mt-3`}>
              Reset
            </button>
          </div>
        ) : (
          <ul className="dg-ruled mt-6">
            {visible.map((d, i) => {
              const hits = brandHits.get(d.id)
              // A brand named after its distillery needs no note: the row already matched by name.
              const brandNote = hits && !d.name.toLowerCase().includes(q) ? hits.join(', ') : null
              return (
                <Row
                  key={d.id}
                  d={d}
                  number={i + 1}
                  brandNote={brandNote}
                  onMap={pinIds.has(d.id)}
                  isExpanded={expanded === d.id}
                  isHighlighted={selected?.id === d.id}
                  onToggle={() => toggleRow(d.id)}
                  onShowOnMap={() => showOnMap(d)}
                />
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
