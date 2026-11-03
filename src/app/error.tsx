'use client'

import Link from 'next/link'
import ErrorScreen, { PRIMARY, SECONDARY } from '@/components/ErrorScreen'

// Any page that throws while rendering lands here; the root layout stays in place.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen label="Error" headline="Something went wrong.">
      <button type="button" onClick={reset} className={PRIMARY}>
        Try again
      </button>
      <Link href="/" className={SECONDARY}>
        Home
      </Link>
    </ErrorScreen>
  )
}
