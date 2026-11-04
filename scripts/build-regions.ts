// Writes src/data/regions.json from stops.json and outline.json. Run after any pin or region change:
//   npm run build:regions
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Stop } from '../src/data/types'
import { computeRegions, regionProblems } from '../src/lib/regions'

const read = <T>(file: string) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T
const stops = read<Stop[]>('src/data/stops.json')
const outline = read<{ width: number; height: number }>('src/data/outline.json')

const regions = computeRegions(stops, outline.width, outline.height)
writeFileSync(join(process.cwd(), 'src/data/regions.json'), JSON.stringify(regions, null, 2) + '\n')
for (const r of regions) console.log(`${r.id}: area ${JSON.stringify(r.area)} target ${JSON.stringify(r.target)}`)
const problems = regionProblems(regions)
problems.forEach((p) => console.error(`error: ${p}`))
if (problems.length) process.exit(1)
