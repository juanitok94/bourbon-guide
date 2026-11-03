'use client'

// Static night-style state map: an SVG drawn from build-time data. No tiles, no map library, no panning.
// Pins (only for entries with verified lat/lng) take their ownership group's colour and marker letter
// (groups.json; the group chips above the map are the key for these). Shape: bottle tag = tours by
// appointment, circle otherwise. Closed = --closed with an X. Independents (no group) = --teal, no letter.
// The state outline comes from map.json's FIPS code.
import type { KeyboardEvent } from 'react'
import { MAP, type Stop } from '@/data/types'
import { groupOf } from '@/lib/groups'
import type { MapLayout } from '@/lib/map-layout'
import { PLACE } from '@/lib/site'

// Local coordinates, centred on (0,0).
export const BOTTLE = 'M-4.5 -15 H4.5 V-7 Q10.5 -5 10.5 -1 V12 Q10.5 15 7.5 15 H-7.5 Q-10.5 15 -10.5 12 V-1 Q-10.5 -5 -4.5 -7 Z'

// Extra background on the right (viewBox units) so the key can float beside the state on desktop.
// On phones the SVG is drawn 130% wide and the extra space is clipped, so the state fills the width.
const KEY_GUTTER = 300

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
    d.status === 'closed' ? 'closed' : null,
  ]
  return parts.filter(Boolean).join(', ')
}

// The real pin graphic, shared by the map and the key.
export function PinGraphic({
  shape,
  closed = false,
  color = 'var(--teal)',
  marker = null,
}: {
  shape: PinShape
  closed?: boolean
  color?: string
  marker?: string | null
}) {
  const fill = closed ? 'var(--closed)' : color
  const centerY = shape === 'bottle' ? 3 : 0
  return (
    <>
      <circle className="dg-ring" r="21" fill="none" strokeWidth="2.5" />
      <g fill={fill} stroke="var(--bg)" strokeWidth="2" strokeLinejoin="round">
        {shape === 'bottle' ? <path d={BOTTLE} /> : <circle r="12.5" />}
      </g>
      {closed ? (
        <path
          d={`M-5 ${centerY - 5} L5 ${centerY + 5} M5 ${centerY - 5} L-5 ${centerY + 5}`}
          stroke="var(--text)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : marker ? (
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

function Compass() {
  // Hand-drawn style compass rose: uneven kites, a loose dashed ring, a serif N.
  const kite = (len: number, w: number, filled: boolean) => (
    <>
      <path d={`M0 ${-len} L${w} ${-w} L0 0 Z`} fill={filled ? 'var(--amber)' : 'none'} />
      <path d={`M0 ${-len} L${-w} ${-w} L0 0 Z`} fill="none" />
    </>
  )
  return (
    <svg
      viewBox="-30 -32 60 62"
      className="h-10 w-10 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="var(--amber)"
      strokeWidth="1.1"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <circle r="10.5" strokeDasharray="2.2 1.4" opacity="0.8" />
      <g opacity="0.75">
        {[45, 135, 225, 315].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            {kite(14.5, 2.2, false)}
          </g>
        ))}
      </g>
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a + (a === 90 ? 1.5 : a === 270 ? -1 : 0)})`}>
          {kite(a === 0 ? 23 : 19, 3.6, true)}
        </g>
      ))}
      <text
        x="0"
        y="-26"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="var(--amber)"
        stroke="none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        N
      </text>
    </svg>
  )
}

// Shapes and status only; group colours and letters are keyed by the group chips above the map.
const KEY: { label: string; shape: PinShape; closed?: boolean }[] = [
  { label: 'Tours by appointment', shape: 'bottle' },
  { label: 'Closed', shape: 'circle', closed: true },
]

function MapKey() {
  return (
    <div className="border-t border-line bg-surface px-3 py-3 md:absolute md:right-3 md:bottom-3 md:w-56 md:rounded-xl md:border md:bg-bg/70 md:p-2.5 md:backdrop-blur-md">
      <div className="hidden items-center justify-between md:flex">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Map key</h2>
        <Compass />
      </div>
      <h2 className="sr-only md:hidden">Map key</h2>
      <p className="mb-1.5 hidden text-xs text-muted md:block">Pin colors and letters match the group chips above the map.</p>
      <ul className="flex flex-wrap gap-2 md:flex-col md:gap-0.5">
        {KEY.map((k) => (
          <li
            key={k.label}
            className="flex items-center gap-1.5 rounded-full border border-line bg-raised py-0.5 pr-3 pl-1 text-xs text-text md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:text-sm"
          >
            <svg viewBox="-17 -17 34 34" className="h-6 w-6 shrink-0" aria-hidden="true">
              <PinGraphic shape={k.shape} closed={k.closed} color="var(--muted)" />
            </svg>
            {k.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StateMap({
  layout,
  entries,
  selectedId,
  onSelect,
}: {
  layout: MapLayout
  entries: Stop[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const pinById = new Map(layout.pins.map((p) => [p.id, p]))
  const shown = entries.filter((d) => pinById.has(d.id))
  // Selected pin draws last so it sits on top.
  const ordered = [...shown].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))

  const onKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-ocean">
      <svg
        viewBox={`0 0 ${layout.width + KEY_GUTTER} ${layout.height}`}
        role="group"
        aria-label={`Map of ${PLACE} distilleries (${MAP.title}). The list below the map is the accessible alternative to this map.`}
        className="block h-auto w-[130%] max-w-none md:w-full"
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
        <rect width={layout.width + KEY_GUTTER} height={layout.height} fill="var(--ocean)" />
        <path d={layout.path} fill="var(--amber)" opacity="0.22" filter="url(#state-glow)" />
        <path d={layout.path} fill="url(#terrain)" />
        <path d={layout.counties} fill="none" stroke="var(--county)" strokeWidth="0.8" strokeLinejoin="round" />
        <path
          d={layout.path}
          fill="none"
          stroke="var(--amber)"
          strokeOpacity="0.6"
          strokeWidth="1"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        <g aria-hidden="true" style={{ fontFamily: 'var(--font-sans)' }}>
          {layout.cities.map((c) => {
            const o = c.label ?? { dx: 6, dy: 0, anchor: 'start' as const }
            const moved = o.dy !== 0 || Math.abs(o.dx) > 6
            const tx = c.x + o.dx
            const ty = c.y + o.dy
            return (
              <g key={c.name}>
                {moved && <line x1={c.x} y1={c.y} x2={tx} y2={ty} stroke="var(--muted)" strokeOpacity="0.6" strokeWidth="0.8" />}
                <circle cx={c.x} cy={c.y} r="2.4" fill="var(--muted)" />
                <text
                  x={tx}
                  y={ty}
                  textAnchor={o.anchor}
                  dominantBaseline="central"
                  fontSize="10.5"
                  fontWeight="600"
                  letterSpacing="1.2"
                  fill="var(--muted)"
                  stroke="var(--bg)"
                  strokeOpacity="0.8"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {c.name.toUpperCase()}
                </text>
              </g>
            )
          })}
        </g>

        {ordered.map((d) => {
          const p = pinById.get(d.id)!
          const selected = d.id === selectedId
          const group = groupOf(d)
          return (
            <g
              key={d.id}
              className="dg-pin"
              transform={`translate(${p.x} ${p.y}) scale(1.15)`}
              role="button"
              tabIndex={0}
              aria-label={pinLabel(d)}
              aria-expanded={selected}
              aria-controls={selected ? 'map-panel' : undefined}
              onClick={() => onSelect(d.id)}
              onKeyDown={(e) => onKey(e, d.id)}
            >
              <circle r="17" fill="transparent" />
              <PinGraphic
                shape={shapeOf(d)}
                closed={d.status === 'closed'}
                color={group?.color}
                marker={group?.marker ?? null}
              />
            </g>
          )
        })}
      </svg>
      <MapKey />
    </div>
  )
}
