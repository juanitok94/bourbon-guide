// The stops visitors see. Closed stops stay in src/data/stops.json for history (check:data still validates
// them) but are never shown: no pin, card, search/region/group result or count. Every page reads stops here.
import stops from '@/data/stops.json'
import type { Stop } from '@/data/types'

export const VISITOR_STOPS: Stop[] = (stops as Stop[]).filter((d) => d.status !== 'closed')
