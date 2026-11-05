import type { Metadata, Viewport } from 'next'
import '@fontsource/big-shoulders-stencil-display/800'
import '@fontsource/fraunces/600'
import '@fontsource/ibm-plex-mono/500'
import '@fontsource/ibm-plex-mono/600'
import SiteFooter from '@/components/SiteFooter'
import { MAP } from '@/data/types'
import { SEO_DESCRIPTION, SEO_TITLE, SITE_URL } from '@/lib/site'
import './globals.css'

// Makes the share image URL absolute: the configured site address, else the Vercel production domain, else none.
const VERCEL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
const BASE_URL = SITE_URL ?? (VERCEL_HOST ? `https://${VERCEL_HOST}` : null)

export const metadata: Metadata = {
  ...(BASE_URL ? { metadataBase: new URL(BASE_URL) } : {}),
  ...(SITE_URL ? { alternates: { canonical: '/' } } : {}),
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  openGraph: { title: SEO_TITLE, description: SEO_DESCRIPTION, type: 'website', siteName: MAP.title },
  twitter: { card: 'summary_large_image', title: SEO_TITLE, description: SEO_DESCRIPTION },
}

export const viewport: Viewport = {
  themeColor: MAP.accent,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
