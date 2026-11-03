import type { Metadata, Viewport } from 'next'
import SiteFooter from '@/components/SiteFooter'
import TopBar from '@/components/TopBar'
import { MAP } from '@/data/types'
import { fontVars } from '@/lib/fonts'
import { accentStyle, siteDescription } from '@/lib/site'
import './globals.css'

const DESCRIPTION = `${siteDescription()} 21+ only.`

export const metadata: Metadata = {
  title: MAP.title,
  description: DESCRIPTION,
  openGraph: { title: MAP.title, description: DESCRIPTION, type: 'website' },
}

export const viewport: Viewport = {
  themeColor: '#0f0d0b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} style={accentStyle}>
      <body>
        <TopBar />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
