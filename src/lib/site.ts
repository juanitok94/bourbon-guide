import type { CSSProperties } from 'react'
import { MAP } from '@/data/types'

// Everything here derives from src/data/map.json, so no state is hard-coded in the UI.
export const PLACE = MAP.stateName ?? MAP.state

export function siteDescription(): string {
  return `An unofficial map and list of ${PLACE} distilleries.`
}

// The accent colour comes from map.json, so each guide in the family can set its own.
export const accentStyle = { '--accent': MAP.accent } as CSSProperties
