// Builds home-screen icons and src/app/icon.svg from a plain map pin in map.json's accent colour.
// Run after changing the pin or the accent: npm run build:icons. Uses sharp.
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { MAP } from '../src/data/types'

const INK = MAP.accent // --accent
const BG = '#0f0d0b' // --bg
const PIN =
  'M16 1.5C9.7 1.5 4.8 6.3 4.8 12.4c0 7.9 9.2 17 10.4 18.1a1.1 1.1 0 0 0 1.6 0c1.2-1.1 10.4-10.2 10.4-18.1C27.2 6.3 22.3 1.5 16 1.5Z'

function svg(size: number, share: number): string {
  const box = size * share
  const offset = (size - box) / 2
  const scale = box / 32
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path fill="${INK}" d="${PIN}"/>
    <circle cx="16" cy="12.4" r="4.6" fill="${BG}"/>
  </g>
</svg>`
}

const out: [string, number, number][] = [
  ['public/icons/icon-192.png', 192, 0.72],
  ['public/icons/icon-512.png', 512, 0.72],
  ['public/icons/icon-maskable-512.png', 512, 0.56],
  ['src/app/apple-icon.png', 180, 0.68],
]

async function main() {
  writeFileSync(
    'src/app/icon.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path fill="${INK}" d="${PIN}"/>
  <circle cx="16" cy="12.4" r="4.6" fill="${BG}"/>
</svg>
`,
  )
  console.log('wrote src/app/icon.svg')
  mkdirSync('public/icons', { recursive: true })
  for (const [file, size, share] of out) {
    await sharp(Buffer.from(svg(size, share))).png().toFile(file)
    console.log(`wrote ${file} (${size}px)`)
  }
}
main()
