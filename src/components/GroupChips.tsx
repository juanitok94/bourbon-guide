'use client'

// Multi-select ownership-group chips above the map. They double as the map key for pin colours and letters.
// Selected state is shown by aria-pressed, a filled marker and a check mark, never by colour alone.
import GroupMark from '@/components/GroupMark'
import { ALL_GROUP_IDS, GROUPS } from '@/lib/groups'

const CHIP =
  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors'

function Check({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 ${on ? '' : 'invisible'}`} aria-hidden="true">
      <path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function GroupChips({
  selected,
  onToggle,
  onAll,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
}) {
  const all = selected.length === ALL_GROUP_IDS.length
  return (
    <div role="group" aria-labelledby="groups-label" className="mb-4">
      <p id="groups-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        Ownership groups
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={all}
          onClick={onAll}
          className={`${CHIP} ${all ? 'border-amber bg-raised text-text' : 'border-line bg-surface text-muted hover:text-text'}`}
        >
          <Check on={all} />
          All groups
        </button>
        {GROUPS.map((g) => {
          const on = selected.includes(g.id)
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(g.id)}
              className={`${CHIP} ${on ? 'bg-raised text-text' : 'border-line bg-surface text-muted hover:text-text'}`}
              style={on ? { borderColor: g.color } : undefined}
            >
              <GroupMark group={g} filled={on} />
              {g.shortName}
              {g.name !== g.shortName && <span className="sr-only"> ({g.name})</span>}
              <Check on={on} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
