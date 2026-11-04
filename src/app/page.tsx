import Explorer from '@/components/Explorer'
import { MAP } from '@/data/types'
import { GROUPS } from '@/lib/groups'
import { computeLayout } from '@/lib/map-layout'
import { VISITOR_STOPS } from '@/lib/stops'
import { PLACE } from '@/lib/site'

export default function Home() {
  const entries = VISITOR_STOPS
  const layout = computeLayout(entries)
  const verified = entries.filter((d) => d.verifiedOn !== null).length
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold tracking-[0.32em] text-amber">{MAP.kicker}</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.05] font-semibold tracking-tight sm:text-7xl">
          {MAP.title}
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-muted">
          An unofficial guide to {PLACE}&apos;s distilleries. Details are being verified one at a time.
        </p>
        <p className="tabular mt-2 text-sm tracking-wide text-muted">
          {entries.length} in the guide · {verified} verified · {GROUPS.length} groups
        </p>
      </header>
      <Explorer entries={entries} layout={layout} />
    </main>
  )
}
