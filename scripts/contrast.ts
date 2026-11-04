// WCAG contrast for the Wine & Gold tokens, read from globals.css (the one place they are defined).
// Run: npm run check:contrast. check:data fails on the same text pairs and on the group colours from groups.json.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Group } from '../src/data/types'

export type Tokens = Record<string, string>
export type Pair = { name: string; fg: string; bg: string }

// Every `--name: #rrggbb;` in globals.css's :root block.
export function readTokens(): Tokens {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  return Object.fromEntries([...root.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text and the background it actually sits on. Needs 4.5:1.
export function textPairs(t: Tokens): Pair[] {
  const pair = (fg: string, bg: string): Pair => ({ name: `${fg} on ${bg}`, fg: t[fg], bg: t[bg] })
  return [
    pair('--gold', '--wine'), // headline, active labels, links
    pair('--cream', '--wine'), // body text; callout labels in the phone's bands
    pair('--muted', '--wine'), // secondary text
    pair('--wine', '--gold'), // ribbon, active switch segment
    pair('--cream', '--wine-deep'), // dropdown panel, option lists
    pair('--muted', '--wine-deep'), // hovered rows
    pair('--gold', '--wine-deep'), // links on a hovered row
    pair('--wine-deep', '--cream'), // map labels on the island
    pair('--wine-deep', '--paper'), // map labels on the state
  ]
}

// Graphics that must stand out from what is next to them. Needs 3:1.
export function graphicPairs(t: Tokens): Pair[] {
  const pair = (fg: string, bg: string, why: string): Pair => ({ name: `${fg} on ${bg} (${why})`, fg: t[fg], bg: t[bg] })
  return [
    pair('--gold', '--wine', 'control borders, focus ring on the page'),
    pair('--wine-deep', '--paper', 'state outline, stamps, dot stroke, map focus casing'),
    pair('--gold', '--wine-deep', 'focus ring on a stamp'),
  ]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = readTokens()
  const groups = JSON.parse(readFileSync(join(process.cwd(), 'src/data/groups.json'), 'utf8')) as Group[]
  let failed = 0
  const line = (p: Pair, min: number) => {
    const c = contrast(p.fg, p.bg)
    if (c < min) failed++
    console.log(`${c.toFixed(2).padStart(6)}:1  ${c >= min ? 'pass' : 'FAIL'} (${min}:1)  ${p.name}  ${p.fg} / ${p.bg}`)
  }
  console.log('Text')
  textPairs(t).forEach((p) => line(p, 4.5))
  console.log('Group marker letters')
  groups.forEach((g) => line({ name: `${g.shortName} on --wine-deep`, fg: g.color, bg: t['--wine-deep'] }, 4.5))
  console.log('Graphics')
  graphicPairs(t).forEach((p) => line(p, 3))
  if (failed) process.exit(1)
}
