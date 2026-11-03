// Shown above the list: one group selected = its panel; two or more (but not all) = a comparison table.
import GroupMark from '@/components/GroupMark'
import type { Brand, Group, Stop } from '@/data/types'
import { brandsOf } from '@/lib/groups'

export const BRAND_PILL =
  'inline-flex items-center rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs font-semibold text-text'

export function BrandPills({ brands, label }: { brands: Brand[]; label: string }) {
  if (brands.length === 0) return null
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {brands.map((b) => (
        <li key={b.id} className={BRAND_PILL}>
          {b.name}
        </li>
      ))}
    </ul>
  )
}

export function GroupPanel({ group, entries }: { group: Group; entries: Stop[] }) {
  const stops = entries.filter((d) => d.groupId === group.id).length
  const brands = brandsOf(group.id)
  return (
    <section
      aria-labelledby="group-panel-heading"
      className="mt-6 rounded-xl border border-line border-l-4 bg-surface p-4"
      style={{ borderLeftColor: group.color }}
    >
      <div className="flex items-center gap-3">
        <GroupMark group={group} />
        <h3 id="group-panel-heading" className="font-display text-2xl leading-tight font-semibold">
          {group.name}
        </h3>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Headquarters</dt>
        <dd>{group.hq ?? 'Not yet verified'}</dd>
        <dt className="text-muted">Kentucky stops</dt>
        <dd className="tabular">{stops}</dd>
      </dl>
      {brands.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Brands</p>
          <BrandPills brands={brands} label={`${group.name} brands`} />
        </div>
      )}
      {group.website && (
        <a
          href={group.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent hover:text-text"
        >
          {group.name} website<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </section>
  )
}

export function GroupCompare({ groups, entries }: { groups: Group[]; entries: Stop[] }) {
  const rows: { label: string; value: (g: Group) => number }[] = [
    { label: 'Kentucky stops', value: (g) => entries.filter((d) => d.groupId === g.id).length },
    { label: 'Open stops', value: (g) => entries.filter((d) => d.groupId === g.id && d.status === 'open').length },
    { label: 'Brands', value: (g) => brandsOf(g.id).length },
  ]
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Compare groups
        </caption>
        <thead>
          <tr className="border-b border-line">
            <td className="px-3 py-2 sm:px-4" />
            {groups.map((g) => (
              <th key={g.id} scope="col" className="px-2 py-2 text-left align-bottom font-semibold sm:px-3">
                <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-1.5">
                  <GroupMark group={g} size="sm" />
                  {g.shortName}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="px-3 py-2 text-left font-normal text-muted sm:px-4">
                {r.label}
              </th>
              {groups.map((g) => (
                <td key={g.id} className="tabular px-2 py-2 sm:px-3">
                  {r.value(g)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
