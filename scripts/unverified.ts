// Writes data/unverified.csv: one row per stop with no verifiedOn, for working through by hand in a spreadsheet.
// Run: npm run unverified
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Stop } from '../src/data/types'

const stops = JSON.parse(readFileSync(join(process.cwd(), 'src/data/stops.json'), 'utf8')) as Stop[]
const unverified = stops.filter((s) => s.verifiedOn === null)
const COLUMNS = ['id', 'name', 'city', 'region', 'website', 'sourceUrl'] as const
const cell = (v: string | null) => {
  const s = v ?? ''
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const lines = [COLUMNS.join(','), ...unverified.map((s) => COLUMNS.map((c) => cell(s[c])).join(','))]
writeFileSync(join(process.cwd(), 'data/unverified.csv'), lines.join('\r\n') + '\r\n')
console.log(`Wrote data/unverified.csv (${unverified.length} unverified stops)`)
