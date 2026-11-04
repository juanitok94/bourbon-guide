import { MAP, type Stop } from '@/data/types'

// Everything here derives from src/data/map.json, so no state is hard-coded in the UI.
export const PLACE = MAP.stateName ?? MAP.state

export function siteDescription(): string {
  return `An unofficial map and list of ${PLACE} distilleries.`
}

export const SEO_TITLE = MAP.seoTitle ?? MAP.title
export const SEO_DESCRIPTION = MAP.seoDescription ?? siteDescription()

// The deployed address, set per environment. Without it there is no canonical URL and the sitemap is empty.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || null

// schema.org ItemList of the stops passed in, with only verified fields. Safe to put inside a <script>: "<" can't
// close the tag once escaped.
export function homeJsonLd(stops: Stop[]): string {
  const verified = stops.filter((d) => d.status !== 'closed' && d.verifiedOn !== null)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SEO_TITLE,
    itemListElement: verified.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Distillery',
        name: d.name,
        ...(d.address ? { address: d.address } : {}),
        ...(d.website ? { url: d.website } : {}),
      },
    })),
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
