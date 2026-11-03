import type { MetadataRoute } from 'next'
import { MAP } from '@/data/types'
import { siteDescription } from '@/lib/site'

export const dynamic = 'force-static'

// Web app manifest, so "Add to Home Screen" installs cleanly. No service worker.
// Icons are built by scripts/build-icons.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MAP.title,
    short_name: MAP.title,
    description: siteDescription(),
    start_url: '/',
    display: 'standalone',
    theme_color: '#0f0d0b',
    background_color: '#0f0d0b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
