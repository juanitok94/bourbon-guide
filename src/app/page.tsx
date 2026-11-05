import { preload } from 'react-dom'
import Explorer from '@/components/Explorer'
import { MAP } from '@/data/types'
import { computeLayout } from '@/lib/map-layout'
import { homeJsonLd, PLACE } from '@/lib/site'
import { VISITOR_STOPS } from '@/lib/stops'

// The hero photo is pre-toned at build time by npm run hero (scripts/make-hero.mjs). Decorative: empty alt.
const HERO = { w800: '/hero/hero-800.jpg', w1600: '/hero/hero-1600.jpg', width: 1600, height: 840 }
const HERO_SRCSET = `${HERO.w800} 800w, ${HERO.w1600} 1600w`

export default function Home() {
  const entries = VISITOR_STOPS
  const layout = computeLayout(entries)
  preload(HERO.w1600, { as: 'image', imageSrcSet: HERO_SRCSET, imageSizes: '100vw', fetchPriority: 'high' })
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(entries) }} />
      <header className="dg-hero">
        <picture>
          <source type="image/jpeg" srcSet={HERO_SRCSET} sizes="100vw" />
          <img src={HERO.w1600} srcSet={HERO_SRCSET} sizes="100vw" width={HERO.width} height={HERO.height} alt="" fetchPriority="high" decoding="async" />
        </picture>
        <p className="inline-block bg-gold px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-wine">
          UNOFFICIAL · <span className="font-stencil text-sm font-extrabold tracking-[0.08em]">21+</span>
        </p>
        <h1 className="mt-4 font-stencil text-[62px] leading-[0.92] font-extrabold tracking-wide text-gold uppercase md:text-[96px]">
          {MAP.title.split(' ').map((word, i) => (
            <span key={word} className="block md:inline">
              {i > 0 && <span className="hidden md:inline"> </span>}
              {word}
            </span>
          ))}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm">A guide to {PLACE}&apos;s distilleries, from the major producers to the independents.</p>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-4">
        <Explorer entries={entries} layout={layout} />
      </div>
    </main>
  )
}
