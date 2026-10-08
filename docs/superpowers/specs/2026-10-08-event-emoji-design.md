# One emoji per society event — design

Date: 2026-10-08 · Builds on: `2026-10-08-society-events-reduction-design.md` (#515)

## Problem

An event's category does one job: it picks the emoji on the map pin, the list
row and the phone's peek band, plus one word on the detail card. No filter or
sort reads it. Each of the 10 categories draws one specific object (🏐 for
"sports", 🚌 for "trip", 🌍 for "culture"), but the categories are broad, so
about 20 of the 57 events in production show a misleading picture: ice skating
and a picnic as volleyball, three Beerpongs as 🎉, a Christmas market and
historical fencing as 🌍, trips to Finland and Sweden as a bus.

Since reIS now imports every event itself (societies no longer self-post),
choosing a picture per event costs nothing at import time.

## Decision

Each event carries its own emoji, picked from a curated, shipped set of
Twemoji SVGs. The category stays as a coarse fallback.

- **New column** `spolky_events.emoji text null`: a Twemoji codepoint
  filename (`26f8`, `1f1eb-1f1ee`), format-checked in the database. Not
  enumerated in SQL, so the set grows without a migration.
- **Curated catalog** `src/data/eventEmoji.ts`: 84 entries, each with a
  codepoint, the legacy category it maps to, and a picker group. Names are in
  the locale files (`map.emoji.<code>`). Every entry's SVG ships in
  `public/emoji/` (Twemoji 15.1.0, about 146 KB in total).
- **Rendering:** `eventEmojiSrc(event)` returns the event's own emoji when it
  is in the catalog, otherwise its category's emoji. It is used by the pin, the
  list row and the peek band. A code this build does not ship falls back
  instead of breaking.
- **Detail card:** the category line (emoji plus "Párty") is removed. The
  word was wrong as often as the picture, and the title already says what the
  event is. The picture stays on the pin and the row.
- **Composer (admin console):** the 10 category chips become an emoji
  picker: a button showing the current emoji opens a grouped grid. Picking an
  emoji writes `emoji` and its mapped `category`. A new event starts on the
  emoji of the society's latest event, or 🎉.
- **Released builds (5.1.1–5.3.0):** they read `category` unchecked and
  never read `emoji`. `category` therefore stays one of the 10 values the
  database CHECK allows, and the backfill also corrects categories where a
  better one exists (Karneval na ledu → sports, Beerpong → social).
- **Attribution:** Twemoji graphics are CC BY 4.0. The map's attribution
  line gains "Emoji: Twemoji (CC BY 4.0)" next to OpenStreetMap; the 10
  already-shipped SVGs were uncredited until now.

## Out of scope

- Category filters (a list of 2–3 events a week does not need them).
- Shipping the full Twemoji set (about 3,700 files). The catalog grows when
  an import needs a new emoji.
- Deleting the production test row "Deskovky — test notifikace" (4 Sep).
  It is listed for Dominik's approval, not done by the migration.

## Data

Backfill for all 57 production rows by `(association_id, title)`, in
`supabase/backfills/20261010_event_emoji.sql`. "Bruch s USAFem" is left null
(unknown event type) and falls back to its category.

## Privacy

No new data flow: the column is read with the rest of the row, and the SVGs
ship in the bundle. `privacy/disclosures.ts` is unchanged.
