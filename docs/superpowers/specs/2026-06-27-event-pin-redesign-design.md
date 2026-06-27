# Event Pin Redesign + Pan Fix — Design

**Date:** 2026-06-27
**Status:** Approved (design) — supersedes the "floating balloon + rope tether" pin look from
`2026-06-26-events-on-map-design.md`. Everything else in that spec (store, panel tabs, data
seam, faculty filter, clustering, detail card) stays as-is.
**Scope:** Frontend/design only. Two changes: (1) redesign the event pin, (2) fix the bug where
pins drift with the viewport during a map drag. No backend, no data-model rewrite.

## Why

Two problems with the current implementation (`src/components/CampusMap/EventPin.tsx`,
`EventLayer.tsx`):

1. **The pin reads badly.** A poster-in-ring balloon floats up-left of the building, tethered by
   a curved "rope" to a small anchor dot. Map UX research is blunt about this: the #1 marker
   mistake is ambiguity about *which point* the marker refers to, and a balloon-on-a-rope is
   exactly that — the eye can't tell whether the event is at the balloon or the dot. The
   conventional fix is a marker whose **tip is the exact spot** (the iconic teardrop).
2. **Pins drift when you pan.** Moving the map makes the pins travel with the screen and snap
   back only on release (root cause in §3).

Design goals, locked during brainstorming:

- Keep the **circle with the society in it** (society identity stays primary).
- Add a second visual channel that says **what kind of event** it is (party, board games, trip…).
- Sit the marker **directly on the spot** — drop the rope.
- One channel per dimension: society = colour + logo in the body; event type = a distinct icon.

## 1. The pin

A **society-coloured teardrop** anchored on the exact coordinate. Replaces the balloon + rope.

```
        ____
      /  ⌑   \ (•)   <- type badge: white circle, lucide icon in society colour, ~14px, top-right
     | society |     <- round head, society colour, society logo fills it (glyph fallback)
     |  logo   |
      \      /  (2)  <- count badge (only when group > 1): white circle, bottom-right
       \    /
        \  /         <- solid society-colour pointer
         V           <- tip = exact [lng, lat]; this is the anchor
   ────────────────
   building footprint
```

Anatomy:

- **Head** — round, society colour, the society logo image fills it; short `glyph` text fallback
  when the logo is unavailable. (No more event-poster image in the ring — society identity is the
  point of the body.)
- **Pointer** — a solid society-colour triangle directly below the head. Implemented as round head
  + CSS triangle (border trick), **not** an SVG rope and **not** a rotated teardrop — renders
  crisply and avoids counter-rotating the logo.
- **Anchor** — the bottom tip of the pointer is positioned at the screen coordinate `(x, y)`.
  Concretely: the pin container's bottom-centre sits at `(x, y)`; everything else is laid out
  upward from there.
- **Type badge** (top-right of head) — a small white circle holding the event-type lucide icon,
  drawn in the society colour, ~14px. This is the new "what kind of event" channel.
- **Count badge** (bottom-right of head) — shown **only** when a venue group has more than one
  event. The type badge always reflects the **soonest** event in the group; the count badge says
  how many total (e.g. `2`, `3`). Type top-right, count bottom-right — the two corners never collide.
- **Hover** — keep the existing mini sneak-peek bubble (title + date/time, society-coloured) above
  the head. Skipped on touch (unchanged).
- **Selected** — keep the halo (ring in the society colour around the head).

Map overlay colours stay **fixed literals, not theme vars** (the basemap is always light even when
the app theme is dark — existing CampusMap convention).

`EventPin` keeps the same props it has today (`group`, `x`, `y`, `selected`, `locale`, `onSelect`).
Only its internals change. Stays ≤200 lines.

## 2. Event-type taxonomy

The data model has no event-type field today. Add one.

```ts
// src/types/events.ts — additions
export type EventCategory =
  | 'party' | 'boardgames' | 'trip' | 'quiz' | 'sports'
  | 'film' | 'karaoke' | 'culture' | 'social' | 'other';

export interface MapEvent extends MendeluEvent {
  // …existing fields…
  category: EventCategory;
}
```

**Icon mapping** (lucide-react — the library already used throughout; monochrome, consistent
stroke, crisp at ~14px). Lives next to the society catalog, e.g. a `categoryIcon` lookup in a small
`src/data/eventCategories.ts` (icon component + i18n label key per category):

| Category | Lucide icon | Matched in the mock dataset |
|----------|-------------|-----------------------------|
| `party` | `PartyPopper` | NEON Party, Tram Party, Beer Pong, Beerpong, International Student Ball |
| `boardgames` | `Dices` | Deskovky |
| `trip` | `Bus` | Trip to Ostrava |
| `quiz` | `Brain` | PEF Kvíz, Akademické středy — ASY-Quiz |
| `sports` | `Volleyball` | Erasmus Cup: Basketball, Erasmus Cup: Volleyball |
| `film` | `Clapperboard` | Filmový klubík |
| `karaoke` | `Mic` | BU Karaoke, Karaoke Night |
| `culture` | `Globe` | Country Presentation, Tématické dny — Taiwanský den |
| `social` | `Beer` | Tour de Pub, TINDELU, Únikovka |
| `other` | `Sparkles` | fallback |

**Population:**

- **Mock provider** (`src/api/mapEvents.ts`): each `Seed` gets an explicit `category`. Deterministic
  and self-documenting since the titles are known.
- **`inferCategory(title: string): EventCategory`** — a keyword heuristic (lowercased title →
  category, `other` fallback). Used as the default when a seed omits a category, and is the seam the
  real backend's organizer-picked category replaces later. Keep keyword matching tolerant of CZ/EN
  (e.g. `party`, `ples`/`ball`, `deskov`, `kvíz`/`quiz`, `trip`/`výlet`, `karaoke`, `film`,
  `volej`/`basket`/`sport`).

**Consistency across surfaces** — the type icon appears in all three places so it acts as the map's
legend without a separate key:

- the **pin** type badge,
- the **EventsList** rows (`EventsList.tsx`) — small leading type icon per row,
- the **EventDetailCard** (`EventDetailCard.tsx`) — type icon next to the title/society chip.

## 3. The pan bug — root cause + fix

**Root cause (confirmed by reading the code):** `EventLayer` renders pins into a
`absolute inset-0 z-[950]` overlay that is a **sibling of the Leaflet map**, not a child of any
Leaflet pane. It reprojects pin positions only on `moveend zoomend`:

```ts
const bind = (m: L.Map) => { m.on('moveend zoomend', recompute); schedule(); };
```

During a drag, Leaflet translates its own panes continuously but never touches this sibling
overlay, and `recompute` doesn't run until the drag ends. So the pins stay glued to the **screen**
mid-drag and snap to the correct geographic spot only on release — the "events move with me"
symptom.

**Fix:** also listen to the **continuous** `move`/`zoom` events, routed through the existing
rAF-throttled `schedule()` so we reproject at most once per animation frame:

```ts
const bind = (m: L.Map) => { m.on('move zoom moveend zoomend', schedule); schedule(); };
const unbind = (m: L.Map) => { m.off('move zoom moveend zoomend', schedule); };
```

(`recompute` itself is unchanged; it already projects every group via
`map.latLngToContainerPoint`.) Reprojecting a handful of pins per frame is cheap. `moveend`/`zoomend`
stay bound so the final resting position is exact.

**Scope of the fix:** only `EventLayer`. `EdgeIndicators` deliberately stays screen-anchored (its
arrows live at the viewport edge pointing at off-screen POIs), so its `moveend zoomend`-only binding
is correct and is **left unchanged**.

**Alternative considered and rejected:** render pins into a Leaflet custom pane so Leaflet's own
transform moves them during drag (zero per-frame React work). Correct in principle but heavier and
works against the deliberate HTML/Tailwind overlay approach (hover bubbles, DaisyUI). The
continuous-reposition fix is a one-line change that preserves the architecture.

## 4. Tests (test-first)

- `inferCategory`: representative titles map to the right category in both CZ and EN; unknown →
  `other`.
- `mapEvents` mock: every produced `MapEvent` carries a non-null `category`; spot-check a few
  known titles (Deskovky → `boardgames`, Tram Party → `party`, Trip to Ostrava → `trip`).
- `EventPin`: renders the correct type icon for a given category; the count badge appears only when
  `group.events.length > 1` and shows the right number; the pin's tip anchors at the supplied
  `(x, y)` (bottom-centre positioning).
- `EventLayer`: firing a continuous `move` event (not just `moveend`) triggers a reprojection —
  guards the regression. Default render still hides pins in floor view (`activeBuildingId !== null`).

## 5. Out of scope (unchanged from the 2026-06-26 spec)

- Backend / organizer-side category + coordinate picker; real event source, persistence, auth.
- Clustering threshold logic (the venue-grouping helper is reused as-is).
- Notifications / RSVP / any write path.
- The bell/`EventsFeed` dropdown stays as the second, non-map surface for the same data.

## Files touched

| File | Change |
|------|--------|
| `src/types/events.ts` | add `EventCategory`; add `category` to `MapEvent` |
| `src/data/eventCategories.ts` *(new)* | category → lucide icon + label-key lookup; `inferCategory(title)` |
| `src/api/mapEvents.ts` | give each seed an explicit `category` (fallback to `inferCategory`) |
| `src/components/CampusMap/EventPin.tsx` | teardrop rewrite: head + pointer + type badge + count badge |
| `src/components/CampusMap/EventLayer.tsx` | bind continuous `move zoom` (rAF-throttled) — the pan fix |
| `src/components/CampusMap/EventsList.tsx` | leading type icon per row |
| `src/components/CampusMap/EventDetailCard.tsx` | type icon by title/society chip |
| `src/i18n/locales/{cs,en}.json` | category labels |
| tests | `inferCategory`, `EventPin`, `EventLayer` move-reprojection, mock-provider category |
