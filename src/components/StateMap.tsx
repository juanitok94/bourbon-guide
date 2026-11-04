'use client'

// Static night-style state map: an SVG drawn from build-time data. No tiles, no map library. Zooming to a region
// only changes the viewBox (instant under prefers-reduced-motion); pins and labels keep their on-screen size.
// Pins (only for entries with verified lat/lng) take their ownership group's colour and marker letter
// (groups.json; MapKey under the map is the key for these). Shape: bottle tag = tours by appointment,
// circle otherwise. Independents (no group) = --teal, no letter.
// The state outline comes from map.json's FIPS code; region areas from regions.json (npm run build:regions).
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import GroupMark from '@/components/GroupMark'
import regionsData from '@/data/regions.json'
import { MAP, type Stop } from '@/data/types'
import { GROUPS, groupOf } from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import { CITY_PX, PIN_BASE, PIN_PX, REGION_PX, fitView, lerpView, placeLabels, placePins, type Rect } from '@/lib/map-view'
import type { RegionArea } from '@/lib/regions'
import { PLACE } from '@/lib/site'

const REGIONS = regionsData as RegionArea[]
const ZOOM_MS = 450
const PHONE_QUERY = '(max-width: 767.98px)'
const DEFAULT_PX_W = 992 // the column's full width, used until the browser has measured it

// Local coordinates, centred on (0,0).
export const BOTTLE = 'M-4.5 -15 H4.5 V-7 Q10.5 -5 10.5 -1 V12 Q10.5 15 7.5 15 H-7.5 Q-10.5 15 -10.5 12 V-1 Q-10.5 -5 -4.5 -7 Z'

export type PinShape = 'bottle' | 'circle'

export function shapeOf(d: Stop): PinShape {
  return d.toursByAppointment ? 'bottle' : 'circle'
}

export function pinLabel(d: Stop): string {
  const parts = [
    d.name,
    d.city,
    groupOf(d)?.name ?? null,
    d.toursByAppointment ? 'tours by appointment' : null,
  ]
  return parts.filter(Boolean).join(', ')
}

// The real pin graphic, shared by the map and the key.
export function PinGraphic({
  shape,
  color = 'var(--teal)',
  marker = null,
}: {
  shape: PinShape
  color?: string
  marker?: string | null
}) {
  const centerY = shape === 'bottle' ? 3 : 0
  return (
    <>
      <circle className="dg-ring" r="21" fill="none" strokeWidth="2.5" />
      <g fill={color} stroke="var(--bg)" strokeWidth="2" strokeLinejoin="round">
        {shape === 'bottle' ? <path d={BOTTLE} /> : <circle r="12.5" />}
      </g>
      {marker ? (
        <text
          y={centerY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12.5"
          fontWeight="700"
          fill="var(--bg)"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {marker}
        </text>
      ) : (
        <circle cy={centerY} r="3.2" fill="var(--bg)" />
      )}
    </>
  )
}

// One quiet, non-interactive row under the map: each group's marker and colour, plus the appointment shape
// when a pin uses it.
export function MapKey({ showTours }: { showTours: boolean }) {
  // The dots show only on wider screens, where the row stays on one line; on phones a wrap would strand one.
  const dot = (
    <span aria-hidden="true" className="mr-1.5 hidden sm:inline">
      ·
    </span>
  )
  const item = 'flex items-center gap-1.5'
  return (
    <ul aria-label="Map key" className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
      {GROUPS.map((g, i) => (
        <li key={g.id} className={item}>
          {i > 0 && dot}
          <GroupMark group={g} size="sm" />
          {g.shortName}
        </li>
      ))}
      {showTours && (
        <li className={item}>
          {dot}
          <svg viewBox="-17 -17 34 34" className="h-5 w-5 shrink-0" aria-hidden="true">
            <PinGraphic shape="bottle" color="var(--muted)" />
          </svg>
          Tours by appointment
        </li>
      )}
    </ul>
  )
}

const subscribePhone = (onChange: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const readPhone = () => window.matchMedia(PHONE_QUERY).matches

const distilleries = (n: number) => `${n} ${n === 1 ? 'distillery' : 'distilleries'}`
const regionName = (id: string) => MAP.regions.find((r) => r.id === id)?.label ?? id
// The viewBox for a region, or the whole state when it has no area on the map.
function viewFor(regionId: string, mapW: number, mapH: number): Rect {
  const area = REGIONS.find((r) => r.id === regionId)?.area
  return area ? fitView(area, mapW, mapH) : { x: 0, y: 0, w: mapW, h: mapH }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export default function StateMap({
  layout,
  entries,
  selectedId,
  onSelect,
  regionId,
  regionCounts,
  onRegion,
  animate,
}: {
  layout: MapLayout
  entries: Stop[]
  selectedId: string | null
  onSelect: (id: string) => void
  regionId: string
  regionCounts: Record<string, number>
  onRegion: (id: string) => void
  animate: boolean
}) {
  const isPhone = useSyncExternalStore(subscribePhone, readPhone, () => false)
  const [pxW, setPxW] = useState(DEFAULT_PX_W)
  const wrapRef = useRef<HTMLDivElement>(null)
  const wholeRef = useRef<HTMLButtonElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // Where focus goes after a zoom, because the control just used goes away.
  const focusAfter = useRef<string | null>(null)

  const mapW = layout.width
  const mapH = layout.height
  const active = REGIONS.find((r) => r.id === regionId) ?? null
  const [view, setView] = useState<Rect>({ x: 0, y: 0, w: mapW, h: mapH })
  const [moving, setMoving] = useState(false)
  const viewRef = useRef<Rect>(view)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setPxW(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const from = viewRef.current
    const targetView = viewFor(regionId, mapW, mapH)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = animate && !reduce ? ZOOM_MS : 0
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      const next = t === 1 ? targetView : lerpView(from, targetView, easeInOut(t))
      viewRef.current = next
      setView(next)
      setMoving(t < 1)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [regionId, mapW, mapH, animate])

  useEffect(() => {
    const want = focusAfter.current
    if (!want) return
    focusAfter.current = null
    if (want === 'whole') wholeRef.current?.focus({ preventScroll: true })
    else svgRef.current?.querySelector<SVGGElement>(`[data-region="${want}"]`)?.focus({ preventScroll: true })
  }, [regionId])

  const zoomTo = (id: string) => {
    focusAfter.current = 'whole'
    onRegion(id)
  }
  const zoomOut = () => {
    focusAfter.current = regionId
    onRegion('all')
  }

  const u = view.w / pxW // map units per screen pixel
  const pinById = new Map(layout.pins.map((p) => [p.id, p]))
  const shown = entries.filter((d) => pinById.has(d.id))
  const positions = placePins(
    shown.map((d) => ({
      id: d.id,
      x: pinById.get(d.id)!.x0,
      y: pinById.get(d.id)!.y0,
      bound: active ? null : REGIONS.find((r) => r.id === d.region)?.target,
    })),
    view,
    pxW,
  )
  // Selected pin draws last so it sits on top.
  const ordered = [...shown].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
  const pinK = (u * PIN_PX) / PIN_BASE

  const showRegionButtons = !active
  // Labels stay hidden during the zoom, so they don't jump between spots frame to frame.
  const labels = moving
    ? { cities: [], regions: [] }
    : placeLabels({
        view,
        pxW,
        pins: [...positions.values()],
        cities: layout.cities,
        regions: active ? [] : REGIONS.map((r) => ({ id: r.id, label: regionName(r.id), box: r.target })),
      })

  // On a phone's whole-state view the regions are the targets, so pins are drawn but not interactive.
  const pinsLive = !isPhone || active !== null

  const onPinKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }
  const onRegionKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      zoomTo(id)
    }
  }

  return (
    <>
      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-line bg-ocean">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="group"
          aria-label={`Map of ${PLACE} distilleries (${MAP.title}). The list below the map is the accessible alternative to this map.`}
          className="block h-auto w-full"
        >
          <defs>
            <filter id="state-glow" x="-10%" y="-20%" width="120%" height="140%">
              <feGaussianBlur stdDeviation="12" />
            </filter>
            <linearGradient id="terrain" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2b2118" />
              <stop offset="0.45" stopColor="#1c1915" />
              <stop offset="1" stopColor="#191a19" />
            </linearGradient>
          </defs>
          <rect width={layout.width} height={layout.height} fill="var(--ocean)" />
          <path d={layout.path} fill="var(--amber)" opacity="0.22" filter="url(#state-glow)" />
          <path d={layout.path} fill="url(#terrain)" />
          <path d={layout.counties} fill="none" stroke="var(--county)" strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path
            d={layout.path}
            fill="none"
            stroke="var(--amber)"
            strokeOpacity="0.6"
            strokeWidth="1"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {showRegionButtons
            ? REGIONS.map((r) => {
                const n = regionCounts[r.id] ?? 0
                return (
                  <g
                    key={r.id}
                    data-region={r.id}
                    className="dg-region"
                    role="button"
                    tabIndex={0}
                    aria-label={`Zoom to ${regionName(r.id)}, ${distilleries(n)}`}
                    onClick={() => zoomTo(r.id)}
                    onKeyDown={(e) => onRegionKey(e, r.id)}
                  >
                    <rect
                      className="dg-region-box"
                      x={r.target.x}
                      y={r.target.y}
                      width={r.target.w}
                      height={r.target.h}
                      rx={10 * u}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                )
              })
            : null}

          <g aria-hidden="true" pointerEvents="none" style={{ fontFamily: 'var(--font-sans)' }}>
            {labels.cities.map((c) => (
              <g key={c.text}>
                {c.leader && (
                  <line x1={c.cx} y1={c.cy} x2={c.x} y2={c.y} stroke="var(--muted)" strokeOpacity="0.6" strokeWidth={0.8 * u} />
                )}
                <circle cx={c.cx} cy={c.cy} r={2.4 * u} fill="var(--muted)" />
                <text
                  data-city-label
                  x={c.x}
                  y={c.y}
                  textAnchor={c.anchor}
                  dominantBaseline="central"
                  fontSize={CITY_PX * u}
                  fontWeight="600"
                  letterSpacing={1.1 * u}
                  fill="var(--muted)"
                  stroke="var(--bg)"
                  strokeOpacity="0.8"
                  strokeWidth={3 * u}
                  paintOrder="stroke"
                >
                  {c.text.toUpperCase()}
                </text>
              </g>
            ))}
            {labels.regions.map((r) => (
              <text
                key={r.id}
                data-region-label
                x={r.x}
                y={r.y}
                textAnchor={r.anchor}
                dominantBaseline="central"
                fontSize={REGION_PX * u}
                fontWeight="700"
                fill="var(--amber)"
                stroke="var(--bg)"
                strokeOpacity="0.85"
                strokeWidth={3 * u}
                paintOrder="stroke"
              >
                {r.text}
              </text>
            ))}
          </g>

          {ordered.map((d) => {
            const p = positions.get(d.id)
            if (!p) return null
            const selected = d.id === selectedId
            const group = groupOf(d)
            return (
              <g
                key={d.id}
                data-pin={d.id}
                className="dg-pin"
                transform={`translate(${p.x} ${p.y}) scale(${pinK})`}
                style={pinsLive ? undefined : { pointerEvents: 'none' }}
                {...(pinsLive
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': pinLabel(d),
                      'aria-expanded': selected,
                      'aria-controls': selected ? 'map-panel' : undefined,
                      onClick: () => onSelect(d.id),
                      onKeyDown: (e: KeyboardEvent<SVGGElement>) => onPinKey(e, d.id),
                    }
                  : { 'aria-hidden': true })}
              >
                <circle r="20" fill="transparent" />
                <PinGraphic shape={shapeOf(d)} color={group?.color} marker={group?.marker ?? null} />
              </g>
            )
          })}
        </svg>
      </div>

      {REGIONS.length > 0 && (
        <div className="mt-2 flex min-h-11 flex-wrap items-center justify-center gap-x-3 text-sm text-muted">
          {active ? (
            <>
              <button
                ref={wholeRef}
                type="button"
                onClick={zoomOut}
                className="min-h-11 rounded-lg border border-line bg-surface px-4 font-semibold text-amber transition-colors hover:border-amber"
              >
                Whole state
              </button>
              <span>
                {regionName(active.id)} · {distilleries(regionCounts[active.id] ?? 0)}
              </span>
            </>
          ) : (
            <>
              <span className="md:hidden">Tap a region to zoom in.</span>
              <span className="hidden md:inline">Click a region to zoom in.</span>
            </>
          )}
        </div>
      )}
    </>
  )
}
