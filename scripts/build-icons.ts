// Builds the tab and home-screen icons: a square stamp, --wine-deep fill, a gold 3px border and a gold stencil "B"
// (Big Shoulders Stencil Display 800, from the installed @fontsource package). Run: npm run icons
// Writes src/app/icon.png (512), src/app/apple-icon.png (180) and public/icons/* for the web manifest.
// The letter is a font glyph, so the page is rendered in the installed Chrome or Edge (headless), as make-og.mjs does.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const WINE_DEEP = '#3a0d19'
const GOLD = '#e2bf7a'
const BORDER = 3 // px in the finished icon
const LETTER = 'B'
const FONT = join(process.cwd(), 'node_modules/@fontsource/big-shoulders-stencil-display/files/big-shoulders-stencil-display-latin-800-normal.woff2')

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const exe = BROWSERS.find((b): b is string => Boolean(b) && existsSync(b as string))
if (!exe) throw new Error('No Chrome or Edge found. Set CHROME_PATH.')

const SIZE = 512
const tmp = mkdtempSync(join(tmpdir(), 'icons-'))
const font = `data:font/woff2;base64,${readFileSync(FONT).toString('base64')}`

// One 512px render. `border` is in 512px units; `inset` (0..1) shrinks the stamp inside a wine-deep field for maskable icons.
function render(name: string, border: number, inset: number): string {
  const box = SIZE * (1 - inset * 2)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Stencil;font-weight:800;src:url(${font}) format('woff2')}
*{margin:0;box-sizing:border-box}
html,body{width:${SIZE}px;height:${SIZE}px;background:${WINE_DEEP};overflow:hidden}
.stamp{position:absolute;left:${(SIZE - box) / 2}px;top:${(SIZE - box) / 2}px;width:${box}px;height:${box}px;border:${border}px solid ${GOLD};background:${WINE_DEEP};
  display:flex;align-items:center;justify-content:center;color:${GOLD};font:800 ${box * 0.74}px/1 Stencil}
.stamp span{display:block;transform:translateY(${box * 0.02}px)}
</style></head><body><div class="stamp"><span>${LETTER}</span></div></body></html>`
  const page = join(tmp, `${name}.html`)
  const shot = join(tmp, `${name}.png`)
  writeFileSync(page, html)
  execFileSync(
    exe as string,
    ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${SIZE},${SIZE}`, '--virtual-time-budget=3000', `--screenshot=${shot}`, `file:///${page.replace(/\\/g, '/')}`],
    { stdio: 'ignore' },
  )
  return shot
}

async function write(shot: string, out: string, size: number) {
  await sharp(shot).extract({ left: 0, top: 0, width: SIZE, height: SIZE }).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log(`wrote ${out} (${size}px)`)
}

async function main() {
  mkdirSync('public/icons', { recursive: true })
  const full = render('full', BORDER, 0) // 3px border at 512
  const small = render('small', (BORDER * SIZE) / 180, 0) // 3px border once scaled to 180
  const maskable = render('maskable', BORDER, 0.14) // stamp inside the maskable safe zone
  await write(full, 'src/app/icon.png', 512)
  await write(small, 'src/app/apple-icon.png', 180)
  await write(full, 'public/icons/icon-512.png', 512)
  await write(full, 'public/icons/icon-192.png', 192)
  await write(maskable, 'public/icons/icon-maskable-512.png', 512)
  rmSync(tmp, { recursive: true, force: true })
}
main()
