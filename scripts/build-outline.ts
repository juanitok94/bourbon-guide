// Build-time step: extracts the state named by map.json `fips` from us-atlas (U.S. Census Bureau),
// projects it with d3-geo (Lambert conformal conic fitted to the state) and writes src/data/outline.json
// (SVG paths, size, projection params, geographic bounds).
// Run: npm run build:outline (output is committed; the page re-creates the projection from it).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { geoBounds, geoConicConformal, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { MAP } from '../src/data/types'

const r = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

const topo = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/us-atlas/states-10m.json'), 'utf8'),
) as Topology
const states = feature(topo, topo.objects.states as GeometryCollection)
const state = states.features.find((f) => String(f.id) === MAP.fips)
if (!state) throw new Error(`state FIPS ${MAP.fips} not found`)

// Projection fitted to the state: central meridian at its middle, standard parallels at 1/6 and 5/6 of its height.
const [[west, south], [east, north]] = geoBounds(state)
const rotate: [number, number] = [r(-(west + east) / 2), 0]
const parallels: [number, number] = [r(south + (north - south) / 6), r(north - (north - south) / 6)]

const WIDTH = 1000
const PAD = 24
const projection = geoConicConformal().rotate(rotate).parallels(parallels)
projection.fitWidth(WIDTH - PAD * 2, state)
const [tx, ty] = projection.translate()
projection.translate([tx + PAD, ty + PAD])
const [, [, y1]] = geoPath(projection).bounds(state)
const height = Math.ceil(y1 + PAD)

const path = geoPath(projection).digits(1)(state)
if (!path) throw new Error('empty path')

// Interior county lines only (shared borders between two counties of this state), from us-atlas counties-10m.
const ctopo = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/us-atlas/counties-10m.json'), 'utf8'),
) as Topology
const stateCounties = (ctopo.objects.counties as GeometryCollection).geometries.filter((g) =>
  String(g.id).startsWith(MAP.fips),
)
const countyMesh = mesh(ctopo, { type: 'GeometryCollection', geometries: stateCounties } as GeometryCollection, (a, b) => a !== b)
const counties = geoPath(projection).digits(1)(countyMesh)
if (!counties) throw new Error('empty county mesh')

const out = {
  source: `U.S. Census Bureau via us-atlas (states-10m, counties-10m), FIPS ${MAP.fips}`,
  fips: MAP.fips,
  width: WIDTH,
  height,
  rotate,
  parallels,
  scale: projection.scale(),
  translate: projection.translate(),
  bounds: { south: r(south), north: r(north), west: r(west), east: r(east) },
  path,
  counties,
}
writeFileSync(join(process.cwd(), 'src/data/outline.json'), JSON.stringify(out) + '\n')
console.log(`outline.json FIPS ${MAP.fips} ${WIDTH}x${height}, path ${path.length} chars, counties ${counties.length} chars`)
