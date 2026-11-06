// Table schemas shared by export and pull, plus a small RFC 4180 CSV writer/reader.
// The repo's JSON keeps the field names and order; CSV columns match them 1:1 so a round trip is lossless.
//   null            -> empty field
//   boolean         -> true / false
//   arrays (trails) -> JSON text, e.g. ["Kentucky Bourbon Trail"]
import type { Brand, Group, Stop } from '../../src/data/types'

type ColType = 'string' | 'number' | 'boolean' | 'json'
type Column = { name: string; type: ColType; nullable: boolean }
export type TableDef = { name: 'stops' | 'groups' | 'brands'; file: string; columns: Column[] }

const s = (name: string, nullable = false): Column => ({ name, type: 'string', nullable })
const n = (name: string): Column => ({ name, type: 'number', nullable: true })
const b = (name: string): Column => ({ name, type: 'boolean', nullable: false })
const j = (name: string): Column => ({ name, type: 'json', nullable: false })

// Keep in the same order as src/data/types.ts. check:data validates whatever comes back.
export const TABLES: TableDef[] = [
  {
    name: 'stops',
    file: 'src/data/stops.json',
    columns: [
      s('id'), s('mapId'), s('state'), s('groupId', true), s('scale'), s('name'), j('trails'), b('toursByAppointment'),
      s('region', true), s('city', true), s('address', true), n('lat'), n('lng'), s('geocodeSource', true), s('phone', true),
      s('website', true), s('instagram', true), s('hoursNote', true), s('status'), s('blurb', true), s('sourceUrl', true),
      s('sourceNote'), s('verifiedOn', true), s('note', true),
    ],
  },
  {
    name: 'groups',
    file: 'src/data/groups.json',
    columns: [
      s('id'), s('name'), s('shortName'), s('marker'), s('color'), s('hq', true), s('website', true),
      s('ownership', true), s('ownershipSourceUrl', true), s('sourceUrl', true), s('verifiedOn', true),
    ],
  },
  {
    name: 'brands',
    file: 'src/data/brands.json',
    columns: [s('id'), s('name'), s('groupId'), s('stopId', true), s('sourceUrl', true), s('verifiedOn', true)],
  },
]

export type Row = Stop | Group | Brand
type Rec = Record<string, unknown>

// Fails loudly if the JSON has fields the schema doesn't know (or is missing some), so the
// Fabric tables can't silently drift from the shared record shape.
export function assertShape(t: TableDef, rows: Rec[]): void {
  const cols = t.columns.map((c) => c.name)
  rows.forEach((r, i) => {
    const keys = Object.keys(r)
    const extra = keys.filter((k) => !cols.includes(k))
    const missing = cols.filter((c) => !keys.includes(c))
    if (extra.length || missing.length)
      throw new Error(
        `${t.name} row ${i + 1}: schema mismatch (extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}). Update scripts/fabric/tables.ts.`,
      )
  })
}

const quote = (v: string) => (/[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v)

function cell(c: Column, v: unknown): string {
  if (v === null || v === undefined) return ''
  if (c.type === 'json') return quote(JSON.stringify(v))
  if (c.type === 'string' && v === '') return '""' // keep "" distinct from null
  return quote(String(v))
}

export function toCsv(t: TableDef, rows: Rec[]): string {
  const head = t.columns.map((c) => c.name).join(',')
  const body = rows.map((r) => t.columns.map((c) => cell(c, r[c.name])).join(','))
  return [head, ...body].join('\r\n') + '\r\n'
}

// Minimal RFC 4180 parser. Returns raw fields; `quoted` lets us tell "" (empty string) from an empty field (null).
type Field = { text: string; quoted: boolean }
function parseCsv(text: string): Field[][] {
  const rows: Field[][] = []
  let row: Field[] = []
  let field = ''
  let quoted = false
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') {
      inQuotes = true
      quoted = true
    } else if (ch === ',') {
      row.push({ text: field, quoted })
      field = ''
      quoted = false
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push({ text: field, quoted })
      rows.push(row)
      row = []
      field = ''
      quoted = false
    } else field += ch
  }
  if (inQuotes) throw new Error('CSV ends inside a quoted field')
  if (field !== '' || quoted || row.length) {
    row.push({ text: field, quoted })
    rows.push(row)
  }
  return rows
}

function value(t: TableDef, c: Column, f: Field, at: string): unknown {
  if (f.text === '' && !f.quoted) {
    if (c.nullable) return null
    if (c.type === 'json') throw new Error(`${at}: ${c.name} is required`)
    if (c.type === 'string') throw new Error(`${at}: ${c.name} is required`)
  }
  switch (c.type) {
    case 'string':
      return f.text
    case 'number': {
      const x = Number(f.text)
      if (!Number.isFinite(x)) throw new Error(`${at}: ${c.name} is not a number ("${f.text}")`)
      return x
    }
    case 'boolean':
      if (f.text === 'true') return true
      if (f.text === 'false') return false
      throw new Error(`${at}: ${c.name} must be true or false ("${f.text}")`)
    case 'json':
      try {
        return JSON.parse(f.text)
      } catch {
        throw new Error(`${at}: ${c.name} is not valid JSON`)
      }
  }
}

export function fromCsv(t: TableDef, text: string): Rec[] {
  const rows = parseCsv(text.replace(/^﻿/, '')) // tolerate a BOM from Excel/Fabric exports
  if (!rows.length) throw new Error(`${t.name}: empty CSV`)
  const header = rows[0].map((f) => f.text.trim())
  const want = t.columns.map((c) => c.name)
  if (header.join(',') !== want.join(','))
    throw new Error(`${t.name}: header mismatch.\n  got:      ${header.join(',')}\n  expected: ${want.join(',')}`)
  return rows.slice(1).map((r, i) => {
    const at = `${t.name} row ${i + 1}`
    if (r.length !== want.length) throw new Error(`${at}: ${r.length} fields, expected ${want.length}`)
    const rec: Rec = {}
    t.columns.forEach((c, k) => (rec[c.name] = value(t, c, r[k], at)))
    return rec
  })
}
