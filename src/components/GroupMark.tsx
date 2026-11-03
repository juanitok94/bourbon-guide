import type { Group } from '@/data/types'

// A group's marker letter in a circle. "filled": group colour behind a --bg letter; otherwise an outline
// with the letter in the group colour. Colours come from groups.json (checked for AA on --bg/--surface/--raised).
export default function GroupMark({ group, filled = true, size = 'md' }: { group: Group; filled?: boolean; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-xs'
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold leading-none ${box}`}
      style={
        filled
          ? { backgroundColor: group.color, borderColor: group.color, color: 'var(--bg)' }
          : { borderColor: group.color, color: group.color }
      }
    >
      {group.marker}
    </span>
  )
}
