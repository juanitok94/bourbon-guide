import Link from 'next/link'
import { MAP } from '@/data/types'

// Thin bar at the top of every page: home link on the left. 44px minimum target.
export default function TopBar() {
  return (
    <nav aria-label="Main" className="border-b border-line bg-bg/80 px-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-sm font-semibold tracking-wide text-text">
          <svg viewBox="0 0 32 32" className="h-5 w-5 text-accent" aria-hidden="true">
            <path
              fill="currentColor"
              d="M16 1.5C9.7 1.5 4.8 6.3 4.8 12.4c0 7.9 9.2 17 10.4 18.1a1.1 1.1 0 0 0 1.6 0c1.2-1.1 10.4-10.2 10.4-18.1C27.2 6.3 22.3 1.5 16 1.5Z"
            />
            <circle cx="16" cy="12.4" r="4.6" fill="#0f0d0b" />
          </svg>
          {MAP.title}
        </Link>
      </div>
    </nav>
  )
}
