import stops from '@/data/stops.json'
import { MAP, type Stop } from '@/data/types'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Status line computed from the data at build time; credits and trademark notices from map.json.
export default function SiteFooter() {
  const entries = stops as Stop[]
  const dates = entries.map((d) => d.verifiedOn).filter((v): v is string => v !== null)
  const latest = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
  const parts = [
    `${entries.length} distilleries`,
    `${dates.length} verified`,
    latest ? `Last checked ${formatDate(latest)}` : null,
    'Unofficial',
    '21+',
    'Built by Peachy Kean DevOps, LLC',
  ].filter(Boolean)
  return (
    <footer className="mt-16 border-t border-line bg-raised">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        <p className="leading-relaxed">{parts.join(' · ')}</p>
        <div className="mt-3 space-y-1.5 font-normal normal-case leading-relaxed tracking-normal">
          {MAP.trademarks?.map((t) => <p key={t.term}>{t.notice}</p>)}
          {MAP.credits.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
      </div>
    </footer>
  )
}
