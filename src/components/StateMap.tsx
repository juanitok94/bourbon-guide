'use client'

// The map island: the state inside a ringed oval, drawn at build time. No tiles, no map library. Zooming to a region
// only changes the nested viewBox (instant under prefers-reduced-motion); stamps, dots and labels keep their on-screen
// size. Majors are square stamps grouped into callouts with leader lines to their true positions; independents are
// gold dots. The outline comes from map.json's FIPS code, the oval from src/lib/island.ts, regions from regions.json.
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import GroupMark from '@/components/GroupMark'
import regionsData from '@/data/regions.json'
import { MAP, type Stop } from '@/data/types'
import { GROUPS, groupOf } from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import {
  DOT_R,
  LABEL_PX,
  STAMP_PX,
  fitView,
  inOval,
  layoutCallouts,
  leadersOf,
  lerpView,
  placeCities,
  placeDots,
  toPx,
  type Rect,
} from '@/lib/map-view'
import type { RegionArea } from '@/lib/regions'
import { PLACE } from '@/lib/site'

const REGIONS = regionsData as RegionArea[]
const ZOOM_MS = 450
const PHONE_QUERY = '(max-width: 767.98px)'
const DEFAULT_PX_W = 992 // the column's full width, used until the browser has measured it
const LINE_H = 13
const STAMP_TILT = -4

export function pinLabel(d: Stop): string {
  const parts = [
    d.name,
    d.city,
    groupOf(d)?.shortName ?? 'Independent',
    d.toursByAppointment ? 'tours by appointment' : null,
  ]
  return parts.filter(Boolean).join(', ')
}

// One quiet, non-interactive row under the map: each group's stamp.
export function MapKey() {
  const item = 'flex items-center gap-1.5'
  return (
    <ul aria-label="Map key" className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted">
      {GROUPS.map((g) => (
        <li key={g.id} className={item}>
          <GroupMark group={g} size="sm" />
          {g.shortName}
        </li>
      ))}
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

// The view for a region, or the whole island when it has no area on the map.
function viewFor(regionId: string, whole: Rect): Rect {
  const area = REGIONS.find((r) => r.id === regionId)?.area
  return area ? fitView(area, whole) : whole
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

  const { x: wholeX, y: wholeY, w: wholeW, h: wholeH } = layout.island
  const whole: Rect = { x: wholeX, y: wholeY, w: wholeW, h: wholeH }
  const active = REGIONS.find((r) => r.id === regionId) ?? null
  const [view, setView] = useState<Rect>(whole)
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
    const targetView = viewFor(regionId, { x: wholeX, y: wholeY, w: wholeW, h: wholeH })
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
  }, [regionId, wholeX, wholeY, wholeW, wholeH, animate])

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

  const pinById = new Map(layout.pins.map((p) => [p.id, p]))
  const stops = entries.filter((d) => pinById.has(d.id))
  const majors = stops.filter((d) => d.scale === 'major')
  const independents = stops.filter((d) => d.scale === 'independent')
  const stopById = new Map(stops.map((d) => [d.id, d]))

  // Callouts are laid out for where the zoom is heading, so they hold still while their leaders follow the moving map.
  const targetView = viewFor(regionId, whole)
  const { frame, callouts } = layoutCallouts({
    pins: majors.map((d) => ({
      id: d.id,
      lat: d.lat!,
      lng: d.lng!,
      x: pinById.get(d.id)!.x0,
      y: pinById.get(d.id)!.y0,
      city: d.city,
      region: d.region,
    })),
    avoid: [...independents.map((d) => ({ x: pinById.get(d.id)!.x0, y: pinById.get(d.id)!.y0 })), ...layout.cities],
    view: targetView,
    whole,
    pxW,
  })
  const dotSpots = placeDots(
    independents.map((d) => ({ id: d.id, x: pinById.get(d.id)!.x0, y: pinById.get(d.id)!.y0 })),
    view,
    frame.ew,
  )
  const cx = frame.ex + frame.ew / 2
  const cy = frame.ey + frame.eh / 2
  const majorSpots = callouts.flatMap((c) => c.cells.map((cell) => toPx(frame, view, cell.pin.x, cell.pin.y)))
  const cityLabels = moving
    ? []
    : placeCities({
        frame,
        view,
        cities: layout.cities,
        callouts,
        spots: [...majorSpots, ...[...dotSpots.values()].map((p) => toPx(frame, view, p.x, p.y))],
      })

  // On a phone's whole-state view the regions are the targets for dots: there is no room to give each one 44px.
  const dotsLive = !isPhone || active !== null
  const showRegionButtons = !active

  const onKey = (e: KeyboardEvent<SVGGElement>, run: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      run()
    }
  }

  const leaders = leadersOf(frame, view, callouts)

  return (
    <>
      <div ref={wrapRef} className={pxW === DEFAULT_PX_W ? 'dg-island-unmeasured' : undefined}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${frame.pxW} ${frame.pxH}`}
          role="group"
          aria-label={`Map of ${PLACE} distilleries (${MAP.title}). The list below the map is the accessible alternative to this map.`}
          className="block h-auto w-full"
        >
          <defs>
            <clipPath id="island-clip">
              <ellipse cx={cx} cy={cy} rx={frame.ew / 2} ry={frame.eh / 2} />
            </clipPath>
          </defs>

          {/* Outward from the oval: gold border, a wine gap, then the cream ring. */}
          <ellipse cx={cx} cy={cy} rx={frame.ew / 2 + 6} ry={frame.eh / 2 + 6} fill="none" stroke="var(--cream)" strokeWidth="2" />
          <ellipse cx={cx} cy={cy} rx={frame.ew / 2} ry={frame.eh / 2} fill="var(--cream)" stroke="var(--gold)" strokeWidth="2" />

          <g clipPath="url(#island-clip)">
            <svg x={frame.ex} y={frame.ey} width={frame.ew} height={frame.eh} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
              <path
                d={layout.path}
                fill="var(--paper)"
                stroke="var(--wine-deep)"
                strokeWidth="1.4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {showRegionButtons &&
                REGIONS.map((r) => {
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
                      onKeyDown={(e) => onKey(e, () => zoomTo(r.id))}
                    >
                      <rect
                        className="dg-region-box"
                        x={r.target.x}
                        y={r.target.y}
                        width={r.target.w}
                        height={r.target.h}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  )
                })}
            </svg>
          </g>

          <g aria-hidden="true" pointerEvents="none">
            {/* Each leader is gold across the page and wine-deep over the island, so it reads on both. */}
            {leaders.map((l) => (
              <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--gold)" strokeWidth="1" />
            ))}
            <g clipPath="url(#island-clip)">
              {leaders.map((l) => (
                <g key={l.key}>
                  <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--wine-deep)" strokeWidth="1" />
                  <circle cx={l.x2} cy={l.y2} r="2.5" fill="var(--wine-deep)" />
                </g>
              ))}
            </g>
            {cityLabels.map((c) => (
              <g key={c.name}>
                <circle cx={c.dotX} cy={c.dotY} r="2" fill="var(--wine-deep)" fillOpacity="0.7" />
                <text
                  data-city-label
                  x={c.x}
                  y={c.y}
                  textAnchor={c.anchor}
                  dominantBaseline="central"
                  fontSize={LABEL_PX}
                  fill="var(--wine-deep)"
                  stroke="var(--paper)"
                  strokeWidth="3"
                  paintOrder="stroke"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}
                >
                  {c.name}
                </text>
              </g>
            ))}
            {callouts.map((c) =>
              c.lines.map((line, i) => (
                <text
                  key={`${c.key}-${i}`}
                  data-callout-label
                  x={c.x + c.w / 2}
                  y={(c.labelAbove ? c.y : c.y + c.h - c.lines.length * LINE_H) + LINE_H * (i + 0.5)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={LABEL_PX}
                  letterSpacing="0.4"
                  fill={c.inBand ? 'var(--cream)' : 'var(--wine-deep)'}
                  stroke={c.inBand ? 'none' : 'var(--paper)'}
                  strokeWidth={c.inBand ? 0 : 3}
                  paintOrder="stroke"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}
                >
                  {line}
                </text>
              )),
            )}
          </g>

          {independents.map((d) => {
            const at = dotSpots.get(d.id)
            if (!at) return null
            const p = toPx(frame, view, at.x, at.y)
            if (!inOval(frame, p.x, p.y)) return null
            return (
              <g
                key={d.id}
                data-pin={d.id}
                className="dg-pin"
                transform={`translate(${p.x} ${p.y})`}
                style={dotsLive ? undefined : { pointerEvents: 'none' }}
                {...(dotsLive
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': pinLabel(d),
                      'aria-expanded': d.id === selectedId,
                      'aria-controls': d.id === selectedId ? `card-${d.id}-details` : undefined,
                      onClick: () => onSelect(d.id),
                      onKeyDown: (e: KeyboardEvent<SVGGElement>) => onKey(e, () => onSelect(d.id)),
                    }
                  : { 'aria-hidden': true })}
              >
                <circle r="22" fill="transparent" />
                <circle className="dg-ring-casing" r={DOT_R + 5} fill="none" />
                <circle className="dg-ring" r={DOT_R + 5} fill="none" />
                <circle r={DOT_R} fill="var(--gold)" stroke="var(--wine-deep)" strokeWidth="0.8" />
              </g>
            )
          })}

          {callouts.flatMap((c) =>
            c.cells.map((cell) => {
              const d = stopById.get(cell.pin.id)
              const group = d ? groupOf(d) : null
              if (!d || !group) return null
              const half = STAMP_PX / 2
              return (
                <g
                  key={d.id}
                  data-pin={d.id}
                  className="dg-pin"
                  transform={`translate(${cell.cx} ${cell.cy})`}
                  role="button"
                  tabIndex={0}
                  aria-label={pinLabel(d)}
                  aria-expanded={d.id === selectedId}
                  aria-controls={d.id === selectedId ? `card-${d.id}-details` : undefined}
                  onClick={() => onSelect(d.id)}
                  onKeyDown={(e) => onKey(e, () => onSelect(d.id))}
                >
                  <rect x="-22" y="-22" width="44" height="44" fill="transparent" />
                  <g transform={`rotate(${STAMP_TILT})`}>
                    <rect className="dg-ring-casing" x={-half - 4} y={-half - 4} width={STAMP_PX + 8} height={STAMP_PX + 8} fill="none" />
                    <rect className="dg-ring" x={-half - 4} y={-half - 4} width={STAMP_PX + 8} height={STAMP_PX + 8} fill="none" />
                    <rect x={-half} y={-half} width={STAMP_PX} height={STAMP_PX} fill="var(--wine-deep)" stroke={group.color} strokeWidth="1.6" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="19"
                      fill={group.color}
                      style={{ fontFamily: 'var(--font-stencil)', fontWeight: 800 }}
                    >
                      {group.marker}
                    </text>
                  </g>
                </g>
              )
            }),
          )}
        </svg>
      </div>

      {REGIONS.length > 0 && (
        <div className="mt-2 flex min-h-6 flex-wrap items-center justify-center gap-x-3 text-xs text-muted">
          {active ? (
            <>
              <button
                ref={wholeRef}
                type="button"
                onClick={zoomOut}
                className="min-h-11 border-[1.5px] border-gold px-4 text-sm text-gold transition-colors hover:bg-wine-deep"
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
