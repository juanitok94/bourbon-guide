'use client'

import './globals.css'
import ErrorScreen, { PRIMARY, SECONDARY } from '@/components/ErrorScreen'
import SiteFooter from '@/components/SiteFooter'
import { fontVars } from '@/lib/fonts'
import { accentStyle } from '@/lib/site'

// Used only when the root layout itself fails, so it brings its own <html> and <body>.
// Plain <a> for Home: a full reload is the safest way out of a broken layout.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className={fontVars} style={accentStyle}>
      <body>
        <ErrorScreen label="Error" headline="Something went wrong.">
          <button type="button" onClick={reset} className={PRIMARY}>
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={SECONDARY}>
            Home
          </a>
        </ErrorScreen>
        <SiteFooter />
      </body>
    </html>
  )
}
