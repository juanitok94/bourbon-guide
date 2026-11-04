import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { VISITOR_STOPS } from '@/lib/stops'

export const dynamic = 'force-static'

// One page. A sitemap needs absolute URLs, so it stays empty until NEXT_PUBLIC_SITE_URL is set.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return []
  const dates = VISITOR_STOPS.map((d) => d.verifiedOn).filter((v): v is string => v !== null)
  const latest = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
  return [{ url: `${SITE_URL}/`, ...(latest ? { lastModified: latest } : {}) }]
}
