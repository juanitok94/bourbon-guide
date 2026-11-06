// Renders the Open Graph share image (1200x630) to src/app/opengraph-image.jpg.
// Reads the outline, stops, groups and the licensed hero photo (src/data/images.json) from src/data, so rerun `npm run og` when the design or the stops change.
// Run through tsx (npm run og) so it can reuse src/lib/island.ts. Uses the installed Chrome or Edge, headless.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { geoConicConformal } from 'd3-geo'
import sharp from 'sharp'
import { computeIsland } from '../src/lib/island.ts'

const root = resolve(import.meta.dirname, '..')
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const outline = json('src/data/outline.json')
const stops = json('src/data/stops.json').filter((s) => s.status !== 'closed')
const groups = json('src/data/groups.json')
const map = json('src/data/map.json')
const images = json('src/data/images.json')

const W = 1200
const H = 630
const M = 80 // safe margin
const C = { wine: '#6a1a2e', wineDeep: '#3a0d19', gold: '#e2bf7a', cream: '#f4e8d6', paper: '#e9d3a8', muted: '#d9b9a0' }

// Hero photo: centre-cropped, then a wine-to-gold duotone kept dark enough that the gold headline and the muted line
// stay at AA contrast (4.5:1) over it. The photo is the first record in images.json; with none, the plain wine ground is used.
import { rgb, tone } from './lib/hero-tone.mjs'
let photoUri = null
if (images.length > 0) {
  const photo = images[0]
  let pipeline = sharp(join(root, photo.localPath)).resize({ width: 2400, withoutEnlargement: true })
  // An optional crop (in the stored file's pixels) keeps marks or brand text out of frame; otherwise the centre is used.
  if (photo.crop) pipeline = sharp(await pipeline.toBuffer()).extract(photo.crop)
  const { data } = await pipeline.resize(W, H, { fit: 'cover', position: 'centre' }).greyscale().normalise().raw().toBuffer({ resolveWithObject: true })
  // Brighter warm tone, wine veil and light shafts (scripts/lib/hero-tone.mjs); the guard darkens only the pixels under the text.
  const zones = [
    { name: 'headline', x0: M, y0: M - 4, x1: M + 520, y1: M + 280, fg: rgb(C.gold), min: 4.5 },
    { name: 'tagline', x0: M, y0: H - M - 30, x1: M + 700, y1: H - M + 4, fg: rgb(C.muted), min: 4.5 },
  ]
  const { rgb: out3, report } = await tone(data, W, H, zones)
  for (const r of report) {
    console.log(`Contrast over photo, ${r.name}: ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`)
    if (r.ratio < r.min) throw new Error(`${r.name} is ${r.ratio.toFixed(2)}:1 over the photo; needs ${r.min}:1.`)
  }
  const jpg = await sharp(out3, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toBuffer()
  photoUri = `data:image/jpeg;base64,${jpg.toString('base64')}`
}

// Fonts from the installed @fontsource packages, embedded so the page needs no network.
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')}`
const stencil = font('big-shoulders-stencil-display', 'big-shoulders-stencil-display-latin-800-normal.woff2')
const mono = font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2')

// The oval and the state, in the outline's own units, then fitted into the right half of the safe area.
const isl = computeIsland(outline.path)
const ovalW = 540
const k = ovalW / (isl.rx * 2)
const ovalH = isl.ry * 2 * k
const ox = W - M - ovalW // left edge of the oval
const oy = (H - ovalH) / 2 - 10
const toX = (x) => ox + (x - (isl.cx - isl.rx)) * k
const toY = (y) => oy + (y - (isl.cy - isl.ry)) * k

const proj = geoConicConformal().rotate(outline.rotate).parallels(outline.parallels).scale(outline.scale).translate(outline.translate)
const groupById = new Map(groups.map((g) => [g.id, g]))

// Majors' stamps at their true spots, nudged apart where they would overlap (same idea as the live map).
const STAMP = 24
const pins = stops
  .filter((s) => s.scale === 'major' && s.lat !== null && s.lng !== null && groupById.has(s.groupId))
  .map((s) => {
    const [px, py] = proj([s.lng, s.lat])
    return { g: groupById.get(s.groupId), x: toX(px), y: toY(py) }
  })
for (let iter = 0; iter < 300; iter++) {
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      let dx = pins[j].x - pins[i].x
      let dy = pins[j].y - pins[i].y
      let d = Math.hypot(dx, dy)
      if (d >= STAMP + 4) continue
      if (d < 0.01) { dx = 1; dy = 0; d = 1 }
      const push = (STAMP + 4 - d) / 2
      pins[i].x -= (dx / d) * push; pins[i].y -= (dy / d) * push
      pins[j].x += (dx / d) * push; pins[j].y += (dy / d) * push
    }
  }
}

const half = STAMP / 2
const stampSvg = pins
  .map(
    (p) => `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(-4)">
      <rect x="${-half}" y="${-half}" width="${STAMP}" height="${STAMP}" fill="${C.wineDeep}" stroke="${p.g.color}" stroke-width="2"/>
      <text text-anchor="middle" dominant-baseline="central" y="1" font-size="17" fill="${p.g.color}" font-family="Stencil" font-weight="800">${p.g.marker}</text>
    </g>`,
  )
  .join('')

const words = map.title.toUpperCase().split(' ')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Stencil;font-weight:800;src:url(${stencil}) format('woff2')}
@font-face{font-family:Mono;font-weight:500;src:url(${mono}) format('woff2')}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:${C.wine}${photoUri ? ` url(${photoUri}) no-repeat` : ''};overflow:hidden}
.title{position:absolute;left:${M}px;top:${M - 4}px;font:800 150px/0.9 Stencil;color:${C.gold};letter-spacing:.01em}
.ribbon{position:absolute;left:${M}px;top:${M + 296}px;height:46px;padding:0 30px;display:flex;align-items:center;background:${C.gold};color:${C.wine};
  font:500 22px/1 Mono;letter-spacing:.06em;clip-path:polygon(0 0,100% 0,calc(100% - 14px) 50%,100% 100%,0 100%,14px 50%);padding-left:34px;padding-right:38px}
.line{position:absolute;left:${M}px;bottom:${M}px;font:500 22px/1 Mono;color:${C.muted}}
svg{position:absolute;left:0;top:0}
</style></head><body>
<div class="title">${words.join('<br>')}</div>
<div class="ribbon">UNOFFICIAL · 21+</div>
<div class="line">${map.stateName} distillery tours, majors and independents</div>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <ellipse cx="${ox + ovalW / 2}" cy="${oy + ovalH / 2}" rx="${ovalW / 2}" ry="${ovalH / 2}" fill="${C.cream}" stroke="${C.gold}" stroke-width="3"/>
  <g transform="translate(${toX(0)} ${toY(0)}) scale(${k})"><path d="${outline.path}" fill="${C.paper}" stroke="${C.wineDeep}" stroke-width="${(2 / k).toFixed(2)}" stroke-linejoin="round"/></g>
  ${stampSvg}
</svg></body></html>`

const tmp = mkdtempSync(join(tmpdir(), 'og-'))
const page = join(tmp, 'og.html')
const raw = join(tmp, 'og-raw.png')
writeFileSync(page, html)

const browsers = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const exe = process.env.CHROME_PATH || browsers.find((b) => existsSync(b))
if (!exe) throw new Error('No Chrome or Edge found. Set CHROME_PATH.')

execFileSync(exe, [
  '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${W},${H}`, '--virtual-time-budget=3000', `--screenshot=${raw}`, `file:///${page.replace(/\\/g, '/')}`,
], { stdio: 'ignore' })

// Crop to exactly 1200x630 (headless windows can add chrome), then write a JPEG.
const out = join(root, 'src/app/opengraph-image.jpg')
await sharp(raw).extract({ left: 0, top: 0, width: W, height: H }).jpeg({ quality: 82, mozjpeg: true }).toFile(out)
const kb = Math.round(readFileSync(out).length / 1024)
console.log(`Wrote src/app/opengraph-image.jpg (${W}x${H}, ${kb} KB, ${pins.length} stamps)`)
if (kb > 300) throw new Error('Over 300 KB')
