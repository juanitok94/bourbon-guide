'use client'

// Compact multi-select for ownership groups, in the filter bar. A button opens a small panel of native
// checkboxes. Rules live in toggleGroup (lib/groups): never empty; the selection stays in ?groups=.
import { useEffect, useId, useRef, useState } from 'react'
import GroupMark from '@/components/GroupMark'
import { ALL_GROUP_IDS, GROUPS } from '@/lib/groups'

// Every control in the filter bar shares this: at least 44px tall (a wrapped phone label can grow) and one border.
export const CONTROL =
  'block min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-text transition-colors hover:border-amber focus-visible:border-amber'
// Inputs and selects stay at 16px on phones, or iOS zooms the page when they take focus.
export const FIELD_TEXT = 'text-base md:text-sm'

const ROW = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-text hover:bg-surface'
const CHECKBOX = 'h-5 w-5 shrink-0 accent-accent'

export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-muted ${className}`} aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// "Groups: All", "Groups: Sazerac, Brown-Forman" (one or two names), "Groups: 3 selected".
export function groupsLabel(selected: string[]): string {
  if (selected.length === ALL_GROUP_IDS.length) return 'Groups: All'
  if (selected.length > 2) return `Groups: ${selected.length} selected`
  const names = GROUPS.filter((g) => selected.includes(g.id)).map((g) => g.shortName)
  return `Groups: ${names.join(', ')}`
}

// Phones have no room for two names: "Groups: 2 selected" once more than one group is picked.
export function groupsLabelShort(selected: string[]): string {
  if (selected.length > 1 && selected.length < ALL_GROUP_IDS.length) return `Groups: ${selected.length} selected`
  return groupsLabel(selected)
}

export default function GroupsDropdown({
  selected,
  onToggle,
  onAll,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const all = selected.length === ALL_GROUP_IDS.length

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
      // Runs after the browser moves focus for this press. If the press landed on another control, focus
      // stays there; otherwise it would be lost with the closed panel, so it returns to the button.
      setTimeout(() => {
        const active = document.activeElement
        if (!active || active === document.body || rootRef.current?.contains(active)) {
          buttonRef.current?.focus({ preventScroll: true })
        }
      }, 0)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(e) => {
        // Tabbing out of the panel closes it. A null relatedTarget is a press, handled above.
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`${CONTROL} flex h-full items-center justify-between gap-1.5 text-left text-sm leading-tight max-md:px-2.5`}
      >
        <span className="min-w-0 md:hidden">{groupsLabelShort(selected)}</span>
        <span className="hidden min-w-0 truncate md:inline">{groupsLabel(selected)}</span>
        <Chevron className={open ? 'rotate-180' : ''} />
      </button>
      <div
        id={menuId}
        role="group"
        aria-label="Ownership groups"
        hidden={!open}
        className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-raised p-1 shadow-lg shadow-bg"
      >
        <label className={`${ROW} mb-1 border-b border-line`}>
          <input type="checkbox" checked={all} onChange={onAll} className={CHECKBOX} />
          All groups
        </label>
        {GROUPS.map((g) => (
          <label key={g.id} className={ROW}>
            <input
              type="checkbox"
              checked={selected.includes(g.id)}
              onChange={() => onToggle(g.id)}
              className={CHECKBOX}
            />
            <GroupMark group={g} size="sm" />
            <span>
              {g.shortName}
              {g.name !== g.shortName && <span className="sr-only"> ({g.name})</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
