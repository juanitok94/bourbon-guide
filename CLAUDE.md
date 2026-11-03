# CLAUDE.md

Guidance for Claude Code in this repository.

## Purpose
Bourbon Guide: an unofficial, map-first guide to Kentucky's bourbon distilleries. Map page plus full list.
Statewide. Built by Peachy Kean DevOps, LLC. Static and read-only: `output: "export"`, no API routes, server
actions, database, accounts or live data. The map is a static SVG drawn at build time (no tiles, no map library).
Scaffolded from the NC guide at `C:\distillery-guide`, which is READ ONLY: never modify it or run git in it.

## Git
Commit locally when asked. Push only when the user asks. There is no remote; don't create one unless asked.

## Commands
```bash
npm run dev            # localhost:3000
npm run build          # runs check:data first
npm run lint
npm run tsc            # tsc --noEmit, required before finishing any task
npm run check:data     # --verbose lists every warning
npm run build:outline  # regenerate src/data/outline.json after changing map.json fips
npm run build:icons    # regenerate icons after changing map.json accent
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

## Stack
Next.js 16 App Router, TypeScript strict, Tailwind CSS 4. No plain JavaScript.

## Look: "Copper & Char" (dark only, no light mode)
- Colors are CSS variables on `:root` in `src/app/globals.css` (--bg, --surface, --raised, --line, --text, --muted, --copper, --amber, --teal, --ocean, --state, --county, --closed, --accent, --accent-ink); use the Tailwind tokens (bg-surface, text-muted, border-line, text-accent-ink...), never raw hex in components. Check WCAG AA when changing any pair; --closed is for graphics only, never text on --bg.
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
- Never guess. Unconfirmed field = null. If sources conflict, the distillery's own site wins; report it.
- No personal names in data; business details only.
- Never use or link goatwhiskey.net (serves gambling spam).
- `sourceUrl` must be https and is required once `verifiedOn` is set. ids are unique. status is open, closed or unknown.
- `lat`/`lng` only after the address is verified (5 decimals). Pins appear only for entries with lat/lng; the
  list shows "Not on map yet" otherwise. check:data rejects coordinates outside the state's bounding box.
- Renames, mergers: explain in `note`. Never delete entries; closed ones stay with a Closed badge.
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
- Pin shapes: teal circle (distillery), --accent bottle-shaped tag (tours by appointment), --closed with an X (closed). Keep the bottle tag abstract; it must not read as drinking imagery.
- City labels: `src/data/cities.json` (Census Gazetteer 2023 place file for KY, with sourceUrl; optional `label` offset to avoid collisions). Pin collision nudging runs at build time in `src/lib/map-layout.ts`; `npx tsx scripts/report-nudges.ts` lists moved pins.
- The key floats in a gutter to the right of the state on desktop (clipped on phones) and becomes chips under the map on phones. Pin graphics are shared between the map and the key (`PinGraphic`).

## Visitor UI vs admin views
- The visitor UI has only search by name and a region dropdown (from map.json; Reset shows only when one is set; "Showing X of N" only while narrowed). Closed entries sit in a collapsed "Closed (N)" section; their pins stay on the map.
- With no entries, the map still shows the outline and the list says "Distilleries are being added and verified."
- Admin views (verified counts, unverified lists, missing coordinates) live in `npm run check:data` (`--verbose`), never in the visitor UI.

## Out of scope for v1
Passport or visit tracking, accounts, ratings, reviews, ticketing or purchasing, distillery photos or logos.

## Lab Notes (append mistakes: date - what failed - why - what to do instead)
- 2026-11-03 - A long bash heredoc with many files failed to parse - use the Write tool for multi-file creation.
- 2026-11-03 - City labels Lawrenceburg and Lexington collided on the KY map - check labels visually after adding cities; set `label` offsets in cities.json.
