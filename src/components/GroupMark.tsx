import type { Group } from '@/data/types'

// A group's stamp: a square in --wine-deep with the marker letter and border in the group's colour, tilted like the
// ones on the map. Colours come from groups.json (check:data keeps them at AA on --wine-deep).
export default function GroupMark({ group, size = 'md' }: { group: Group; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5 text-sm' : 'h-6 w-6 text-base'
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 -rotate-[4deg] items-center justify-center border-[1.6px] bg-wine-deep font-stencil leading-none font-extrabold ${box}`}
      style={{ borderColor: group.color, color: group.color }}
    >
      {group.marker}
    </span>
  )
}
