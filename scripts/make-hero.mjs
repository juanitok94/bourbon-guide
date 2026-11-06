// Builds the hero band photo: public/hero/hero-800.jpg and hero-1600.jpg, from the licensed photo in src/data/images.json
// (the same one the share image uses), with the brighter warm tone, wine veil and light shafts from scripts/lib/hero-tone.mjs.
// Run: npm run hero. All effects are baked into the JPEGs (no runtime effects). The guard darkens only the pixels under the
// text, then fails if the subline (cream) is under 4.5:1 or the headline (gold) under 3:1 over the final image.
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { rgb, tone } from './lib/hero-tone.mjs'

const root = resolve(import.meta.dirname, '..')
const images = JSON.parse(readFileSync(join(root, 'src/data/images.json'), 'utf8'))
if (images.length === 0) throw new Error('images.json has no record: no hero photo to build')
const photo = images[0]

const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8')
const tokens = {}
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[m[1]] = m[2]

const W = 1600
const H = 840 // 1.905:1, the crop below
let pipeline = sharp(join(root, photo.localPath)).resize({ width: 2400, withoutEnlargement: true })
if (photo.crop) pipeline = sharp(await pipeline.toBuffer()).extract(photo.crop) // keeps marks out of frame (see images.json)
const { data } = await pipeline.resize(W, H, { fit: 'cover', position: 'centre' }).greyscale().normalise().raw().toBuffer({ resolveWithObject: true })

const box = (x0, y0, x1, y1) => ({ x0: Math.round(W * x0), y0: Math.round(H * y0), x1: Math.round(W * x1), y1: Math.round(H * y1) })
const zones = [
  { name: 'headline (gold, large)', ...box(0.15, 0.22, 0.85, 0.64), fg: rgb(tokens.gold), min: 3 },
  { name: 'subline (cream)', ...box(0.1, 0.56, 0.9, 0.86), fg: rgb(tokens.cream), min: 4.5 },
]
const { rgb: rgbBuf, report } = await tone(data, W, H, zones)
let worst = Infinity
for (const r of report) {
  console.log(`Hero contrast, ${r.name}: ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`)
  worst = Math.min(worst, r.ratio)
  if (r.ratio < r.min) throw new Error(`${r.name} is ${r.ratio.toFixed(2)}:1 over the hero; needs ${r.min}:1.`)
}

mkdirSync(join(root, 'public/hero'), { recursive: true })
for (const w of [800, 1600]) {
  const h = Math.round((w * H) / W)
  const out = join(root, `public/hero/hero-${w}.jpg`)
  const base = sharp(rgbBuf, { raw: { width: W, height: H, channels: 3 } }).resize(w, h)
  let q = 80
  let buf = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer()
  while (buf.length > 150 * 1024 && q > 30) buf = await base.clone().jpeg({ quality: (q -= 5), mozjpeg: true }).toBuffer()
  if (buf.length > 150 * 1024) throw new Error(`hero-${w}.jpg is over 150 KB at quality ${q}`)
  await sharp(buf).toFile(out)
  console.log(`Wrote public/hero/hero-${w}.jpg (${w}x${h}, ${Math.round(buf.length / 1024)} KB, quality ${q})`)
}
