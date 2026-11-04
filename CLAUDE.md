# CLAUDE.md

Guidance for Claude Code in this repository.

## Purpose
Bourbon Guide: an unofficial, map-first guide to Kentucky's bourbon distilleries. Map page plus full list.
Statewide. Built by Peachy Kean DevOps, LLC. Static and read-only: `output: "export"`, no API routes, server
actions, database, accounts or live data. The map is a static SVG drawn at build time (no tiles, no map library).
Scaffolded from the NC guide at `C:\distillery-guide`, which is READ ONLY: never modify it or run git in it.

## Git
Commit locally when asked. Push only when the user asks. The repo has a GitHub remote and Vercel deploys from master, so a push to master publishes the site.

## Commands
```bash
npm run dev            # localhost:3000
npm run build          # runs check:data first
npm run lint
npm run tsc            # tsc --noEmit, required before finishing any task
npm run check:data     # --verbose lists every warning
npm run build:outline  # regenerate src/data/outline.json after changing map.json fips
npm run build:icons    # regenerate icons after changing map.json accent
npm run geocode        # fill lat/lng from OSM Nominatim for verified addresses (-- --dry to preview)
npm run fabric:export  # CSVs for Microsoft Fabric (-- --push to upload)
npm run fabric:pull    # stage data from Fabric (-- --local, -- --apply)
```
To update the guide: edit `src/data/stops.json`, run `check:data`, rebuild.

## Map family (config-driven)
- Everything state-specific lives in `src/data/map.json` (id, title, kicker, state, stateName, fips, regions,
  accent, credits, trademarks). Title, kicker, hero, region filter, map outline, accent colour, footer credits and
  trademark notices all read from it. No state, region or city is hard-coded in components.
- map.json and the shared record shape must stay compatible with the other guides; don't add state-specific fields
  without noting them. `stateName` and `trademarks` are optional family fields added by this guide.
- Records: `src/data/stops.json`, type `Stop` in `src/data/types.ts`. `mapId` = map.json id, `state` = map.json
  state, `region` = one of map.json's region ids (or null). `trails` = program names, `[]` if none.
- KY-specific additions (noted per the family rule): `Stop.groupId` (an id from `src/data/groups.json`, or null
  for independents), plus `src/data/groups.json` (ownership groups: name, shortName, one-letter marker, pin colour,
  hq, website) and `src/data/brands.json` (brand names as plain text, `stopId` only where the group's or the brand's
  own site says the brand is made there or offers its visitor experience there; sourceUrl = that page). check:data enforces ids, cross-references, https sources and pin-colour contrast
  (>= 4.5:1 on --bg). The marker letter always shows, so colour is never the only cue.
- `Stop.geocodeSource` (KY-guide addition): who produced lat/lng, e.g. "OpenStreetMap Nominatim"; required by
  check:data whenever lat/lng are set.
- Region rule (no guessing): `region` = the nearest hub by straight-line distance from the Census point for the
  stop's city or ZIP (Census Gazetteer 2023 place/ZCTA files): Louisville; Bardstown; Lexington or Frankfort
  (`central`). Use `elsewhere` when no hub is within 40 km.

## Microsoft Fabric (scripts only)
- Stubbed two-way link to a Fabric Lakehouse (OneLake Files area, CSV): `scripts/fabric/`. Not yet run against a real workspace.
- `npm run fabric:export` writes `fabric-out/{stops,groups,brands}.csv` (offline, always safe); `-- --push` uploads them.
- `npm run fabric:pull` downloads them into `fabric-in/` and stages JSON; `-- --local` reads `fabric-out/` instead (round-trip test); `-- --apply` replaces `src/data/*.json`, runs check:data, and restores the old files if it fails. Never apply without reviewing the diff; the sourcing rules still apply to data edited in Fabric.
- CSV columns mirror `types.ts` 1:1 (`scripts/fabric/tables.ts`); export fails if the JSON and schema drift. Add a field in both places.
- Credentials: `FABRIC_*` in `.env.local` (gitignored; template `.env.example`) or the shell. Scripts only: never import `scripts/fabric` from `src/`, never use `NEXT_PUBLIC_`. The site stays static: no Fabric calls at runtime.

## Stack
Next.js 16 App Router, TypeScript strict, Tailwind CSS 4. No plain JavaScript.

## Look: "Copper & Char" (dark only, no light mode)
- Colors are CSS variables on `:root` in `src/app/globals.css` (--bg, --surface, --raised, --line, --text, --muted, --copper, --amber, --teal, --ocean, --state, --county, --accent, --accent-ink); use the Tailwind tokens (bg-surface, text-muted, border-line, text-accent-ink...), never raw hex in components. Check WCAG AA when changing any pair.
- `--accent` is set from map.json (inline on `<html>`), a deep bourbon red (#a8452b). It is used for pins, borders and highlights where NC used --copper. It is NOT text-safe on --bg (3.3:1): text in the accent hue uses `--accent-ink`; text on an accent fill uses --text (4.7:1).
- Fonts via next/font (self-hosted at build): Fraunces for headings (`font-display`), Inter for body.
- Theme color is --bg (#0f0d0b) in the viewport meta, manifest and icons.

## Tone and compliance (non-negotiable)
- Copy says "visit" and "explore". Never "drink", "shot", "taste", "buzz", "collect" or "reward".
- 21+ notice on every page (including 404 and error) and in the footer.
- Footer status line, computed from the data: "N distilleries · X verified · Last checked <latest verifiedOn> · Unofficial · 21+ · Built by Peachy Kean DevOps, LLC".
- No levels, badges, streaks or rewards tied to consumption.
- No distillery logos or photos. No agency or association seals or logos. No bottle imagery suggesting drinking.

## Trademark
- "Kentucky Bourbon Trail" is a registered trademark of the Kentucky Distillers' Association (KDA). Never use it as
  this site's name, title, kicker or in a logo (check:data enforces the title/kicker part).
- Trail pills render "Kentucky Bourbon Trail®" (also "Kentucky Bourbon Trail® Craft Tour"). Store trail names in
  data WITHOUT ®; `src/lib/trademarks.ts` adds the mark from map.json `trademarks`.
- Footer carries: "Kentucky Bourbon Trail® is a registered trademark of the Kentucky Distillers' Association. This guide is not affiliated with or endorsed by the KDA."
- Trail membership is a fact like any other: it needs a source (the distillery's own site or the KDA).

## Data and sourcing rules
- Every fact needs a source and a `verifiedOn` date. Unverified entries stay `status: "unknown"`, `verifiedOn: null`.
- Source = the distillery's OWN site, else the Kentucky Distillers' Association or the Kentucky Department of
  Alcoholic Beverage Control. Never directories, Yelp, search summaries or memory.
- Ownership-group stops: find them on the group's OWN corporate site, then confirm each place on its own site.
  `sourceNote` = "Listed by <group> corporate site". Production-only sites (no public visits) are not added.
  If the group's site and recent news disagree (sale, closure, pause), the group's site wins; record the
  conflict in `note` with the news URL. Distilling paused but visitor center open = `status: "open"`.
- Never guess. Unconfirmed field = null. If sources conflict, the distillery's own site wins; report it.
- No personal names in data; business details only.
- Never use or link goatwhiskey.net (serves gambling spam).
- `sourceUrl` must be https and is required once `verifiedOn` is set. ids are unique. status is open, closed or unknown.
- `lat`/`lng` only after the address is verified (5 decimals). `npm run geocode` (OSM Nominatim, 1.1 s between
  requests) accepts a result only if it is in the state, inside the bounding box, matches the stop's city and is a
  house-number or named-place match (never a bare road midpoint); otherwise it logs "needs manual check". A manual
  fix still needs a source; set `geocodeSource` to it. Pins appear only for entries with lat/lng; the
  list shows "Not on map yet" otherwise. check:data rejects coordinates outside the state's bounding box.
- Renames, mergers: explain in `note`. Never delete entries.
- Closed stops stay in the data for history but are never shown to visitors. `src/lib/stops.ts` (`VISITOR_STOPS`)
  drops them before anything renders: no pin, card, search/region/group result, or count (hero, footer, group panel,
  compare table). check:data still validates them and prints the closed count. Never re-add a closed place as new.
- Verify mappings (region, trail, city) against explicit sources. Never assume order.
- Re-verify every 6 months.

## Accessibility rules
- Everything interactive is keyboard reachable, has a visible focus ring and a 44px minimum target.
- `aria-pressed` on filter toggles, `aria-expanded` on disclosure panels.
- Never rely on colour alone (pins differ by shape; status has text).
- Respect `prefers-reduced-motion`: no animated panning.
- The list is the accessible alternative to the map; label the map container accordingly.
- Mobile first. No horizontal scroll at 375px.
- Exception: on phones the map pins may be smaller than 44px. The map is a static overview; the list is the primary tap target. Pins stay focusable buttons with aria-labels.
- Storage (if ever used) goes through `src/lib/safe-storage.ts`; the page must work without it.

## Map
- Outline: `npm run build:outline` reads map.json `fips` and writes `src/data/outline.json` from us-atlas (U.S. Census Bureau), with a Lambert conformal projection fitted to the state, interior county lines and the state's bounding box. Credits come from map.json `credits`.
- Pin shapes: teal circle (distillery), --accent bottle-shaped tag (tours by appointment). Keep the bottle tag abstract; it must not read as drinking imagery.
- City labels: `src/data/cities.json` (Census Gazetteer 2023 place file for KY, with sourceUrl; optional `label` offset to avoid collisions). Pin collision nudging runs at build time in `src/lib/map-layout.ts`; `npx tsx scripts/report-nudges.ts` lists moved pins.
- The map fills the column. The key is one quiet, non-interactive row under it (`MapKey`): each group's marker and shortName, plus "Tours by appointment" when a pin uses that shape. Pin graphics are shared between the map and the key (`PinGraphic`).

## Visitor UI vs admin views
- Page order: kicker, headline, description, stats; map; map key; slim 21+ line; one filter bar (search by name, region dropdown from map.json, groups dropdown; two rows on phones); group panel or compare table; list; footer. Reset (clears all three) and "Showing X of N" appear whenever anything narrows the list.
- Groups dropdown (`GroupsDropdown`): a button with aria-expanded and aria-controls opens a panel of native checkboxes, 44px rows, default all on. Label: "Groups: All", up to two shortNames, or "Groups: 3 selected". Closes on Escape, outside press or tabbing out. "All groups" turns every group on; turning off the last group turns them all back on (never an empty map). Independent stops (groupId null) show only while all groups are on.
- The selection lives in the URL (`?groups=sazerac,brown-forman`; all groups = no parameter), read through `useSyncExternalStore` and written with `history.replaceState`. Unknown ids fall back to all groups. The static HTML always renders all groups.
- One group selected: a group panel (name, HQ, Kentucky stops, all brands, website). Two or more but not all: a compare table (real <table>, column and row headers). Cards show "Part of <group>" and the brands made there (brands.json `stopId`); brands with a null stopId appear only in the group panel.
- With no entries, the map still shows the outline and the list says "Distilleries are being added and verified."
- Admin views (verified counts, unverified lists, missing coordinates) live in `npm run check:data` (`--verbose`), never in the visitor UI.

## Out of scope for v1
Passport or visit tracking, accounts, ratings, reviews, ticketing or purchasing, distillery photos or logos.

## Lab Notes (append mistakes: date - what failed - why - what to do instead)
- 2026-11-03 - A long bash heredoc with many files failed to parse - use the Write tool for multi-file creation.
- 2026-11-03 - City labels Lawrenceburg and Lexington collided on the KY map - check labels visually after adding cities; set `label` offsets in cities.json.
- 2026-11-03 - Fetch summarizers padded corporate pages with general knowledge - read raw HTML (curl + strip tags) or rendered page text for sourcing; never trust a summary.
- 2026-11-03 - Nominatim returned bare road midpoints (no house number) that passed the state/city checks; McCracken Pike's was miles from Woodford Reserve - geocode rejects highway-level matches; never accept a road centroid as a stop's location.
- 2026-11-03 - Pins on city dots hid the city labels - map-layout places labels around pins automatically; still check the map visually after adding pins.
