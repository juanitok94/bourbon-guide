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
npm run check:data     # --verbose lists every warning; also runs scripts/check-leaders.ts (no two callout leaders may meet at 320/375/768/1280px, whole state and each region)
npm run build:outline  # regenerate src/data/outline.json after changing map.json fips
npm run build:regions  # regenerate src/data/regions.json after any pin or region change (check:data fails if stale)
npm run build:icons    # regenerate icons after changing map.json accent
npm run og             # regenerate src/app/opengraph-image.png (share image); rerun when the design or the stops change
npm run geocode        # fill lat/lng from OSM Nominatim for verified addresses (-- --dry to preview)
npm run fabric:export  # CSVs for Microsoft Fabric (-- --push to upload)
npm run fabric:pull    # stage data from Fabric (-- --local, -- --apply)
```
To update the guide: edit `src/data/stops.json`, run `build:regions` if a pin changed, run `check:data`, rebuild.

## Map family (config-driven)
- Everything state-specific lives in `src/data/map.json` (id, title, kicker, seoTitle, seoDescription, state, stateName,
  fips, regions, accent, credits, trademarks). Title, metadata, hero, region filter, map outline, theme colour, footer
  credits and trademark notices all read from it. No state, region or city is hard-coded in components.
- map.json and the shared record shape must stay compatible with the other guides; don't add state-specific fields
  without noting them. `stateName`, `trademarks`, `seoTitle` and `seoDescription` are optional family fields added by this guide.
- Records: `src/data/stops.json`, type `Stop` in `src/data/types.ts`. `mapId` = map.json id, `state` = map.json
  state, `region` = one of map.json's region ids (or null). `trails` = program names, `[]` if none.
- KY-specific additions (noted per the family rule): `Stop.groupId` (an id from `src/data/groups.json`, or null
  for independents), `Stop.scale` ("major" requires a groupId, "independent" requires groupId null; check:data enforces it), plus `src/data/groups.json` (ownership groups: name, shortName, one-letter marker, pin colour,
  hq, website) and `src/data/brands.json` (brand names as plain text, `stopId` only where the group's or the brand's
  own site says the brand is made there or offers its visitor experience there; sourceUrl = that page). check:data enforces ids, cross-references, https sources and group-colour contrast
  (>= 4.5:1 on --wine-deep). The marker letter always shows, so colour is never the only cue.
- `Group.ownership` and `ownershipSourceUrl`: only what the group's own corporate site states, else null; rows then say "Part of <name>". Ownership unverified so far: Sazerac, Brown-Forman.
- On the page, "Majors" means the groups shown in this guide and "Independents" means every other distillery. Never claim a gallons threshold or call anything "craft".
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

## Design decisions
- Look: "Wine & Gold". Printed-label feel: no glassy rounded cards, no shadows or gradients on cards, square corners, 1px or double rules, dotted leaders. It must not look like a generic dark SaaS template.
- Tokens (CSS variables, defined once):
  --wine #6a1a2e (page background)
  --wine-deep #3a0d19 (ink on cream, stamp fills)
  --gold #e2bf7a (headline, ribbon, rules, active controls)
  --cream #f4e8d6 (body text on wine; map island fill)
  --paper #e9d3a8 (state fill inside the map)
  --muted #d9b9a0 (secondary text on wine)
  Group colors (marker letter and stamp border, on --wine-deep): Beam family #e8a94f, Sazerac #5fb3a8, Brown-Forman #e8806a, Heaven Hill #b9a3e6 (read these from groups.json if they differ).
  Verify WCAG AA for every text/background pair with a small script and report the ratios. If any pair fails, adjust that token minimally and tell me.
- Fonts, self-hosted from npm @fontsource packages (no runtime Google Fonts request): "Big Shoulders Stencil Display" 800 for the headline, stamps and ribbon numerals; "Fraunces" 600 for distillery names; "IBM Plex Mono" 500 for labels, controls, small text. Define them as --font-stencil, --font-serif, --font-mono so the serif can be swapped later in one place.
- No text on the page is an image; the headline is real text.

## Look: how it is built
- Tokens are CSS variables on `:root` in `src/app/globals.css`; use the Tailwind tokens (bg-wine, text-muted, border-gold...), never raw hex in components. `npm run check:contrast` prints every pair; check:data fails if a text pair or a group colour on --wine-deep drops below AA.
- map.json `accent` must equal --wine (check:data enforces it): the icons, theme colour and manifest read it.
- Fonts are imported in `src/app/layout.tsx` (`@fontsource/<family>/<weight>`, no `.css` suffix: the packages' exports add it). IBM Plex Mono also loads 600 for the active switch segment.
- Focus rings are gold, 2px, offset 2px. On the map, gold alone disappears on --paper, so stamps and dots draw it with a --wine-deep casing.

## Tone and compliance (non-negotiable)
- Copy says "visit" and "explore". Never "drink", "shot", "taste", "buzz", "collect" or "reward".
- 21+ notice on every page (including 404 and error) and in the footer.
- Footer status line, computed from the data: "N distilleries · Last checked <latest verifiedOn> · 21+ · Built by Peachy Kean DevOps, LLC".
- No levels, badges, streaks or rewards tied to consumption.
- Only freely licensed photos (public domain, CC0, CC BY) recorded in `src/data/images.json`, with the credit shown in the footer; no logos or brand marks in any image. No agency or association seals or logos. No bottle imagery suggesting drinking.

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
  list shows "Not on the map yet" otherwise. check:data rejects coordinates outside the state's bounding box.
- Renames, mergers: explain in `note`. Never delete entries.
- Closed stops stay in the data for history but are never shown to visitors. `src/lib/stops.ts` (`VISITOR_STOPS`)
  drops them before anything renders: no pin, card, search/region/group result, or count (hero, footer, group panel,
  compare table). check:data still validates them and prints the closed count. Never re-add a closed place as new.
- Verify mappings (region, trail, city) against explicit sources. Never assume order.
- Re-verify every 6 months.

## Accessibility rules
- Everything interactive is keyboard reachable, has a visible focus ring and a 44px minimum target.
- `aria-expanded` on disclosure panels. The Majors/Independents/All switch is a radiogroup of native radios.
- Never rely on colour alone (stamps carry their group's letter; status has text).
- Respect `prefers-reduced-motion`: region zoom is instant, with no animation.
- The list is the accessible alternative to the map; label the map container accordingly.
- Mobile first. No horizontal scroll at 375px.
- Stamps are 28px with a 44px target at every size, side by side at a 44px pitch, always focusable buttons with aria-labels. Independents' dots have a 44px target centred on the dot, which can overlap a neighbour's when dots crowd; on a phone's whole-state view dots are not interactive and the region buttons are the targets. The list is always complete.
- Storage (if ever used) goes through `src/lib/safe-storage.ts`; the page must work without it.

## Share image
- `src/app/opengraph-image.jpg` (1200x630, under 300 KB, alt text in `opengraph-image.alt.txt`) is generated by `npm run og` (`scripts/make-og.mjs`, headless Chrome/Edge via tsx). It reads outline, stops and groups from `src/data`, and the hero photo from `src/data/images.json` (original kept in `assets/images/`, outside `public/`, so it is never served; centre-cropped, wine-to-gold duotone, headline and tagline contrast over it asserted at 4.5:1 or the script fails), so rerun it and commit the JPEG when the design or the stops change. The script is .mjs by request; everything else stays TypeScript.
- `images.json` records each photo (title, Commons page, author, license, retrievedOn, localPath); check:data fails if a field is missing, the license is not public domain, CC0 or CC BY (BY-SA/NC/ND fail), sourceUrl is not https, or the file is missing. The footer credit "Photo: <title> by <author>, <license>" appears only while a record exists. Check a candidate photo by eye for faces and brand text before adding it.
- `metadataBase` in layout.tsx: NEXT_PUBLIC_SITE_URL, else https://$VERCEL_PROJECT_PRODUCTION_URL, else omitted. Never hard-code a domain.

## Map
- Outline: `npm run build:outline` reads map.json `fips` and writes `src/data/outline.json` from us-atlas (U.S. Census Bureau), with a Lambert conformal projection fitted to the state and the state's bounding box. Credits come from map.json `credits`. No latitude or longitude gridlines; county lines are in outline.json but not drawn.
- Island: `src/lib/island.ts` computes the oval at build time from the outline: the smallest 2.3:1 ellipse that holds every point of the state, plus 2%. Nothing about it is hard-coded. The state zooms inside it (nested viewBox); the drawing around it is in screen pixels, so stamps, dots and labels keep their size.
- Majors are square stamps (group colour, marker letter, -4 degrees); independents are gold dots. Tours by appointment has no pin shape of its own: the row and the pin's aria-label say it.
- Callouts (`layoutCallouts` in `src/lib/map-view.ts`, computed from the data, no city or state named in code): pins cluster when within 40 km of another pin in the same region (40 km at the whole-state view, tightening with zoom, so a cluster separates as you zoom in). Each cluster is one callout: its distinct city names plus its stamps side by side, with a leader from each stamp to its true position. From 600px up callouts sit inside the oval; narrower, they sit in rows above and below it because the oval has no room for 44px targets, and the leaders cross the ring.
- Band callouts (narrow screens): each goes above or below by the nearer side of its pins, ordered west to east by pin x; if leaders still cross, other side assignments and up to 3 rows are tried. `leadersOf`/`countCrossings` in map-view.ts are shared by the component and check-leaders.
- City labels: `src/data/cities.json` (Census Gazetteer 2023 place file for KY, with sourceUrl). A reference city that already has a callout, or can't be placed clear, is left out of that view.
- The key is one quiet, non-interactive row under the map (`MapKey`): each group's stamp and shortName, plus the gold dot when independents show.

## Visitor UI vs admin views
- Page order: ribbon, headline, description, stats; map; zoom hint or "Whole state" row; map key; slim 21+ line; layer switch; its definition; search; second row of controls; group panel or compare table; ledger list; footer. Reset (clears search, region, groups and trail, not the view) and "Showing X of N" appear whenever anything narrows the list. N and the stats line count the current view.
- Layer switch: Majors (default), Independents, All, as native radios in a radiogroup; `?show=` (omitted for the default), kept alongside `?groups=`, `?region=` and `?trail=`. With no independents in the data, that view says "Independent distilleries are being added and verified." and the map shows no dots.
- Search matches name, city and any brand with a stopId; a match by brand alone adds "Brand: <name>" to the row.
- Second row: Majors shows Groups and Region. Independents shows Region and Trail. All shows Region, Trail and Groups, with Groups as a third control (full width on phones). Trail lists the distinct `trails[]` of the current view and hides when there are none, so Region spans the row. Groups filter Majors only, so independents stay listed in All view whatever is selected.
- Groups dropdown (`GroupsDropdown`): a button with aria-expanded and aria-controls opens a panel of native checkboxes, 44px rows, default all on. Label: "Groups: All", up to two shortNames, or "Groups: 3 selected". Closes on Escape, outside press or tabbing out. "All groups" turns every group on; turning off the last group turns them all back on (never an empty map). 
- The selection lives in the URL (`?groups=sazerac,brown-forman`; all groups = no parameter), read through `useSyncExternalStore` and written with `history.replaceState`. Unknown ids fall back to all groups. The static HTML always renders all groups.
- One group selected: a group panel (name, HQ, Kentucky stops, all brands, website). Two or more but not all: a compare table (real <table>, column and row headers). Rows carry the group's ownership line; the brands made there (brands.json `stopId`) are in the expanded row; brands with a null stopId appear only in the group panel.
- List rows (a ledger, not cards): each row's one button (aria-expanded, at least 44px) expands details inline, showing only non-null fields, one row at a time; Escape collapses it and keeps focus on it. "Show on map" (stops with coordinates; others say "Not on the map yet") scrolls to the map, zooms to the region and selects the pin. Selecting a pin opens, highlights, scrolls to and focuses its row. Collapsing or switching rows clears the selected pin. "Directions" is a plain Google Maps search link: no API key, no embedded map.
- Region zoom: `src/data/regions.json` (generated by `build:regions`; a family addition with no state-specific fields) gives each region with pins a zoom `area` (padded bounding box) and a button `target` (`MIN_TARGET` map units each way, computed so it is 44px at a 320px screen; targets never overlap, and need not hold every pin). A region with no pins, or scattered over more than 40% of the oval, has no entry: it stays in the dropdown, which filters the list without zooming. Picking a region on the map or in the dropdown sets `?region=`, filters the list and animates the nested viewBox (`src/lib/map-view.ts`). Stamps and labels (10px) keep their on-screen size at every zoom.
- With no entries, the map still shows the outline and the list says "Distilleries are being added and verified."
- Admin views (verified counts, unverified lists, missing coordinates) live in `npm run check:data` (`--verbose`), never in the visitor UI.

## Out of scope for v1
Passport or visit tracking, accounts, ratings, reviews, ticketing or purchasing, distillery logos, and any photo not recorded in `images.json`.

## Lab Notes (append mistakes: date - what failed - why - what to do instead)
- 2026-11-03 - A long bash heredoc with many files failed to parse - use the Write tool for multi-file creation.
- 2026-11-03 - City labels Lawrenceburg and Lexington collided on the KY map - check labels visually after adding cities; set `label` offsets in cities.json.
- 2026-11-03 - Fetch summarizers padded corporate pages with general knowledge - read raw HTML (curl + strip tags) or rendered page text for sourcing; never trust a summary.
- 2026-11-03 - Nominatim returned bare road midpoints (no house number) that passed the state/city checks; McCracken Pike's was miles from Woodford Reserve - geocode rejects highway-level matches; never accept a road centroid as a stop's location.
- 2026-11-04 - An ellipse from the bounding box plus 8% cut off 28 of the outline's 259 points - a state's corners need more room than its box suggests; compute the ellipse from the points.
- 2026-11-04 - `@fontsource/x/800.css` fails to resolve under Turbopack - the package exports map `./*` to `./*.css`; import `@fontsource/x/800`.
- 2026-11-03 - Pins on city dots hid the city labels - map-layout places labels around pins automatically; still check the map visually after adding pins.
