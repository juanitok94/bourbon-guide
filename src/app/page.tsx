import Explorer from '@/components/Explorer'
import { MAP } from '@/data/types'
import { computeLayout } from '@/lib/map-layout'
import { homeJsonLd, PLACE } from '@/lib/site'
import { VISITOR_STOPS } from '@/lib/stops'

export default function Home() {
  const entries = VISITOR_STOPS
  const layout = computeLayout(entries)
  return (
    <main className="mx-auto max-w-5xl px-4 pt-8 pb-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(entries) }} />
      <header className="mb-3 text-center">
        <p className="inline-block bg-gold px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-wine">
          UNOFFICIAL · VERIFIED · <span className="font-stencil text-sm font-extrabold tracking-[0.08em]">21+</span>
        </p>
        <h1 className="mt-4 font-stencil text-[62px] leading-[0.92] font-extrabold tracking-wide text-gold uppercase md:text-[96px]">
          {MAP.title.split(' ').map((word, i) => (
            <span key={word} className="block md:inline">
              {i > 0 && <span className="hidden md:inline"> </span>}
              {word}
            </span>
          ))}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm">An unofficial guide to {PLACE}&apos;s distilleries, grouped by owner.</p>
      </header>
      <Explorer entries={entries} layout={layout} />
    </main>
  )
}
