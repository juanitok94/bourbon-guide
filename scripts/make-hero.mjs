// Builds the hero band photo: public/hero/hero-800.jpg and hero-1600.jpg, from the licensed photo in src/data/images.json
// (the same one the share image uses), toned wine to gold. Run: npm run hero
// The page lays a wine overlay (--hero-overlay in globals.css) over this image; this script reads that alpha and fails if the
// subline (cream) or the headline (gold) would drop below contrast over the brightest pixel under the overlay.
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const images = JSON.parse(readFileSync(join(root, 'src/data/images.json'), 'utf8'))
if (images.length === 0) throw new Error('images.json has no record: no hero photo to build')
const photo = images[0]

const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8')
const tokens = {}
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[m[1]] = m[2]
const overlay = css.match(/--hero-overlay:\s*rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([0-9.]+)\s*\)/)
if (!overlay) throw new Error('--hero-overlay (rgb(r g b / alpha)) not found in globals.css')
const OVERLAY = { rgb: [+overlay[1], +overlay[2], +overlay[3]], alpha: +overlay[4] }

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (c) => c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
const SHADOW = rgb(tokens['wine-deep'])
const HIGHLIGHT = rgb(tokens.gold)
const TMAX = 0.5 // how far toward gold the brightest pixel goes before the overlay

const W = 1600
const H = 840 // 1.905:1, the crop below
const crop = photo.crop ?? undefined // keeps marks out of frame (see images.json)
let pipeline = sharp(join(root, photo.localPath)).resize({ width: 2400, withoutEnlargement: true })
if (crop) pipeline = sharp(await pipeline.toBuffer()).extract(crop)
const { data } = await pipeline.resize(W, H, { fit: 'cover', position: 'centre' }).greyscale().normalise().raw().toBuffer({ resolveWithObject: true })

const rgbBuf = Buffer.alloc(W * H * 3)
let tTop = 0
for (let i = 0; i < W * H; i++) {
  const t = (data[i] / 255) * TMAX
  tTop = Math.max(tTop, t)
  for (let c = 0; c < 3; c++) rgbBuf[i * 3 + c] = Math.round(SHADOW[c] + t * (HIGHLIGHT[c] - SHADOW[c]))
}

// Worst case under any text: the brightest toned pixel with the overlay on top.
const brightest = SHADOW.map((v, c) => v + tTop * (HIGHLIGHT[c] - v))
const worst = brightest.map((v, c) => OVERLAY.alpha * OVERLAY.rgb[c] + (1 - OVERLAY.alpha) * v)
const checks = [
  ['subline (cream)', rgb(tokens.cream), 4.5],
  ['headline (gold, large)', rgb(tokens.gold), 3],
]
for (const [name, fg, min] of checks) {
  const r = ratio(fg, worst)
  console.log(`Hero contrast, ${name}: ${r.toFixed(2)}:1 (needs ${min}:1)`)
  if (r < min) throw new Error(`${name} is ${r.toFixed(2)}:1 over the brightest hero pixel; needs ${min}:1. Raise the overlay alpha or lower TMAX.`)
}

mkdirSync(join(root, 'public/hero'), { recursive: true })
for (const w of [800, 1600]) {
  const h = Math.round((w * H) / W)
  const out = join(root, `public/hero/hero-${w}.jpg`)
  const base = sharp(rgbBuf, { raw: { width: W, height: H, channels: 3 } }).resize(w, h)
  let q = 80
  let buf = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer()
  while (buf.length > 150 * 1024 && q > 40) buf = await base.clone().jpeg({ quality: (q -= 5), mozjpeg: true }).toBuffer()
  await sharp(buf).toFile(out)
  console.log(`Wrote public/hero/hero-${w}.jpg (${w}x${h}, ${Math.round(buf.length / 1024)} KB, quality ${q})`)
  if (buf.length > 150 * 1024) throw new Error('Over 150 KB')
}
