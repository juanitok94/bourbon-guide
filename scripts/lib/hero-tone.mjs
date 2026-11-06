// Shared by make-hero.mjs and make-og.mjs: the brighter warm hero treatment, composited into the JPEG (no runtime effects).
//   1. Tone: greyscale L lerps from SHADOW (#3a0d19) to HIGHLIGHT (#f6e2b0).
//   2. A wine veil rgba(70,14,30,.40) over the whole image.
//   3. Four wide, soft light shafts from the top right (screen blend, ~12px blur, warm white). Fixed positions: same every build.
//   4. Contrast guard: inside each text zone any pixel brighter than the zone's limit is darkened just enough (feathered outward),
//      so only the veil near the text gets darker, not the whole image. The result is then measured from the final pixels.
import sharp from 'sharp'

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
export const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

const SHADOW = rgb('#3a0d19')
const HIGHLIGHT = rgb('#f6e2b0')
const VEIL = { rgb: [70, 14, 30], a: 0.4 }
const LIGHT = [255, 240, 205]
const BLUR = 12
// [position from left as a fraction of width at the top edge, width as a fraction of width, opacity, angle in degrees]
const SHAFTS = [
  [0.74, 0.22, 0.55, -24],
  [0.6, 0.12, 0.38, -22],
  [0.88, 0.2, 0.4, -26],
  [0.46, 0.08, 0.24, -20],
]

async function shaftAlpha(W, H, [pos, width, , angle]) {
  const shift = Math.tan((-angle * Math.PI) / 180) * (H + 200) // runs down and to the left from the top right
  const x0 = pos * W
  const hw = (width * W) / 2
  const pts = [[x0 - hw + 100 * Math.tan((-angle * Math.PI) / 180), -100], [x0 + hw + 100 * Math.tan((-angle * Math.PI) / 180), -100], [x0 + hw - shift + 100 * Math.tan((-angle * Math.PI) / 180), H + 100], [x0 - hw - shift + 100 * Math.tan((-angle * Math.PI) / 180), H + 100]]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/><polygon fill="#fff" points="${pts.map((p) => p.join(',')).join(' ')}"/></svg>`
  const { data } = await sharp(Buffer.from(svg)).removeAlpha().extractChannel(0).blur(BLUR).raw().toBuffer({ resolveWithObject: true })
  return data
}

// grey: W*H bytes (already cropped, resized, normalised). zones: [{ name, x0, y0, x1, y1, fg: [r,g,b], min }].
export async function tone(grey, W, H, zones) {
  const px = new Float32Array(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    const L = grey[i] / 255
    for (let c = 0; c < 3; c++) {
      const base = SHADOW[c] + L * (HIGHLIGHT[c] - SHADOW[c])
      px[i * 3 + c] = base * (1 - VEIL.a) + VEIL.rgb[c] * VEIL.a
    }
  }
  for (const s of SHAFTS) {
    const a = await shaftAlpha(W, H, s)
    for (let i = 0; i < W * H; i++) {
      const y = Math.floor(i / W)
      const k = (a[i] / 255) * s[2] * (1 - 0.55 * (y / H)) // fades toward the bottom of the frame
      if (k <= 0) continue
      for (let c = 0; c < 3; c++) px[i * 3 + c] = 255 - (255 - px[i * 3 + c]) * (1 - (k * LIGHT[c]) / 255)
    }
  }
  // Contrast guard: inside the text zones, brightness is compressed with a soft knee so nothing exceeds the zone's limit
  // (texture and shafts stay visible, just dimmer), feathered outward so there is no visible box. Elsewhere nothing changes.
  const feather = Math.max(Math.round(W / 30), 12)
  const m8 = Buffer.alloc(W * H)
  for (const z of zones) {
    const pad = feather * 3
    for (let y = Math.max(0, z.y0 - pad); y < Math.min(H, z.y1 + pad); y++) for (let x = Math.max(0, z.x0 - pad); x < Math.min(W, z.x1 + pad); x++) m8[y * W + x] = 255
  }
  const mask = await sharp(m8, { raw: { width: W, height: H, channels: 1 } }).blur(feather).extractChannel(0).raw().toBuffer()
  const zoneLimit = (z, k) => k * ((lum(z.fg) + 0.05) / (z.min + 0.06) - 0.05)
  const apply = (k) => {
    const o = Buffer.alloc(W * H * 3)
    const zoneAt = new Int8Array(W * H).fill(-1)
    zones.forEach((z, zi) => { for (let y = z.y0; y < z.y1; y++) for (let x = z.x0; x < z.x1; x++) zoneAt[y * W + x] = zi })
    const globalLimit = Math.min(...zones.map((z) => zoneLimit(z, k)))
    for (let i = 0; i < W * H; i++) {
      const p = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]
      const L = lum(p)
      const lim = zoneAt[i] >= 0 ? zoneLimit(zones[zoneAt[i]], k) : globalLimit
      const Lm = L > 0 ? lim * (1 - Math.exp(-L / lim)) : 0
      const fct = L > 0 ? Math.pow(Lm / L, 0.45) : 1
      const m = mask[i] / 255
      for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.max(0, Math.min(255, Math.round(p[c] * (1 - m) + p[c] * fct * m)))
    }
    return o
  }
  const measure = (o) =>
    zones.map((z) => {
      let worst = 0
      for (let y = z.y0; y < z.y1; y++) for (let x = z.x0; x < z.x1; x++) {
        const i = (y * W + x) * 3
        worst = Math.max(worst, lum([o[i], o[i + 1], o[i + 2]]))
      }
      return { name: z.name, ratio: (lum(z.fg) + 0.05) / (worst + 0.05), min: z.min }
    })
  let k = 1
  let out = apply(k)
  let report = measure(out)
  while (report.some((r) => r.ratio < r.min + 0.02) && k > 0.3) {
    k *= 0.94
    out = apply(k)
    report = measure(out)
  }
  return { rgb: out, report }
}
