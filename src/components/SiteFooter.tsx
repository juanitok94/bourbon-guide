import images from '@/data/images.json'
import { MAP, type ImageRecord } from '@/data/types'
import { VISITOR_STOPS } from '@/lib/stops'

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
  const photo = (images as ImageRecord[])[0] ?? null
  const entries = VISITOR_STOPS
  const dates = entries.map((d) => d.verifiedOn).filter((v): v is string => v !== null)
  const latest = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
  const parts = [
    `${entries.length} distilleries`,
    latest ? `Last checked ${formatDate(latest)}` : null,
    '21+',
    'Built by Peachy Kean DevOps, LLC',
  ].filter(Boolean)
  return (
    <footer className="mx-auto mt-12 max-w-5xl px-4 pb-8">
      <div className="dg-ruled pt-5 text-center text-[11px] text-muted">
        <p className="leading-relaxed tracking-[0.08em] uppercase">{parts.join(' · ')}</p>
        <div className="mt-3 space-y-1.5 leading-relaxed">
          {MAP.trademarks?.map((t) => <p key={t.term}>{t.notice}</p>)}
          {photo && (
            <p>
              Photo:{' '}
              <a href={photo.sourceUrl} className="underline underline-offset-2">
                {photo.title}
              </a>{' '}
              by {photo.author},{' '}
              {photo.licenseUrl ? (
                <a href={photo.licenseUrl} className="underline underline-offset-2">
                  {photo.license}
                </a>
              ) : (
                photo.license
              )}{photo.changes ? `. ${photo.changes}` : null}
            </p>
          )}
          {MAP.credits.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
      </div>
    </footer>
  )
}
