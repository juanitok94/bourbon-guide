import { MAP } from '@/data/types'

// Adds ® after the first registered term in a program name, e.g.
// "Kentucky Bourbon Trail Craft Tour" -> "Kentucky Bourbon Trail® Craft Tour". Terms come from map.json.
export function withMarks(name: string): string {
  for (const { term } of MAP.trademarks ?? []) {
    const i = name.indexOf(term)
    if (i !== -1) return `${name.slice(0, i + term.length)}®${name.slice(i + term.length)}`
  }
  return name
}
