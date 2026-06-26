# Events on the Campus Map — Frontend Design

**Date:** 2026-06-26
**Status:** Design approved, ready for plan
**Scope:** Frontend/design only. No backend integration. Event data is mocked behind a
seam so the real source (organizer-authored events with picked coordinates) can drop in later.

## Goal

Surface MENDELU events directly on the campus map as "sneak-peek" pins floating above the
exact room where they happen (e.g. an event in Q01 → a pin hovering over Q01's spot), with a
list of upcoming events in a side panel. Today these events are only reachable through the
`Newspaper`/bell dropdown (`EventsFeed` → `EventsDropdown`). This adds a second, spatial
surface for the same data — the bell stays as-is.

## Decisions (locked during brainstorming)

| Question | Decision |
|----------|----------|
| Pin resting look | **Thumbnail pin** — event poster image in a **society-coloured** ring; falls back to the society's logo glyph when no image |
| Pin hover | Mini speech-bubble (title + date/time) above the pin |
| Pin click | Flies the map to the pin + opens full event card in the **bottom-left detail panel** |
| List placement | **Tabbed right panel** — the existing top-right "Places" panel gains `Events / Places` tabs |
| Organizer = society | Events are authored by **student societies** (ESN MENDELU, SU PEF, AU FRRMS), each with a brand colour + short logo glyph. Pin ring + list dot use the **society** colour. Each society maps to a faculty |
| Scope | **All societies** by default, with an **All / My-faculty** filter toggle (a society's faculty decides inclusion) |
| Location model | Each event carries an **explicit `[lng, lat]` point** (organizer-picked later). No dependency on lazily-loaded room geometry |
| Time window | Events in the **current and next calendar year**, soonest first |
| Unpinnable events | An event with no coordinate is **list-only**, flagged (`online` / `off-campus`); no map pin, clicking does not fly |

## Data model (mocked for this pass)

Extend the existing `MendeluEvent` rather than replace it. New optional fields are populated
by a mock provider now and by the real backend later.

```ts
// src/types/events.ts — additions
export interface Society {
  id: string;                       // 'esn' | 'supef' | 'aufrrms'
  name: string;                     // 'ESN MENDELU', 'SU PEF', 'AU FRRMS'
  color: string;                    // brand colour (ring + list dot)
  glyph: string;                    // short fallback logo, e.g. '✷', 'SU', 'AU'
  facultyKey: FacultyKey;           // for the My-faculty filter
}

export interface MapEvent extends MendeluEvent {
  id: string;                       // stable key (mock: hash of url+date)
  societyId: string;                // FK into the society catalog
  coord: [number, number] | null;   // [lng, lat]; null = unpinnable (list-only)
  roomCode: string | null;          // e.g. "Q01" — display + "fly there" affordance
  venueKind: 'campus' | 'online' | 'offcampus';
}
```

**Society catalog** (static for this pass — `src/data/societies.ts`):

| id | name | color | glyph | faculty |
|----|------|-------|-------|---------|
| `esn` | ESN MENDELU | `#00AEEF` | `✷` | mendelu (all) |
| `supef` | SU PEF | `#0046a0` | `SU` | pef |
| `aufrrms` | AU FRRMS | `#c32897` | `AU` | frrms |

`organizerKey` (faculty) stays for back-compat with the bell feed; on the map the **society**
colour is used. "My faculty" reuses `useEventsFacultySettings` (the user's home faculty is
already derived there) and matches against `society.facultyKey`.

**Mock provider:** `src/api/mapEvents.ts` exposes `fetchMapEvents(language)` returning a static
`MapEvent[]` built from the real society calendars (see appendix). This is the single seam the
real backend replaces. Venue coords come from existing map data:

- **Q (PEF building, id 0)** → `[16.6142, 49.2096]` — SU PEF events
- **FRRMS** (landmark centroid) → `[16.6144, 49.2182]` — AU FRRMS events
- **Tauferovy / sports centre** → `[16.5886, 49.2152]` — ESN sport
- **Koleje JAK** → `[16.6306, 49.2163]` — ESN socials
- `coord: null` → off-campus (trips, Tram Party, escape room, ball)

## Store

Add to `createMapSlice.ts` (state already centralised there; no component-level data fetching):

```ts
mapEvents: MapEvent[];                    // loaded once on map mount
eventFilter: 'all' | 'faculty';          // All vs My-faculty
mapPanelTab: 'places' | 'events';        // which tab the right panel shows
setEventFilter(f): void;
setMapPanelTab(tab): void;
focusEventById(id): void;                 // fly to coord + select; mirrors focusPoiById
```

`MapSelection` gains a variant so the bottom-left `DetailPanel` can render an event:

```ts
| { kind: 'event'; event: MapEvent }
```

`focusEventById` sets `mapSelection: { kind: 'event', event }`, sets `activeBuildingId/FloorId`
to null (overview), and bumps `mapFocusRequest` to trigger the existing fly-to animation. The
target coordinate comes from `event.coord`; unpinnable events are not focusable.

## Components

All new files respect the iron rules: ≤200 lines, DaisyUI semantic classes, direct imports,
no `useEffect` data fetching. **Map overlay colours use fixed literals, not theme vars** — the
basemap is always light even when the app theme is dark (see existing CampusMap convention).

| File | Responsibility |
|------|----------------|
| `CampusMap/MapSidePanel.tsx` | Top-right panel shell with `Events / Places` tabs; renders `LandmarkPicker` or `EventsList`. Replaces the bare `LandmarkPicker` mount in `CampusMapView`. |
| `CampusMap/EventsList.tsx` | Scrollable list for the Events tab: `All / My faculty` toggle, date-grouped rows, empty state. Row click → `focusEventById`. Unpinnable rows show a tag and don't fly. |
| `CampusMap/EventLayer.tsx` | Renders one `EventPin` per pinnable event onto the Leaflet map (via the existing map instance), positioned at `event.coord`. Owns co-location clustering. |
| `CampusMap/EventPin.tsx` | The thumbnail-in-ring marker; hover → mini speech-bubble; click → `focusEventById`. Selected pin gets a halo. |
| `CampusMap/EventDetailCard.tsx` | Body for the `kind: 'event'` branch added to `DetailPanel`: poster, title, date/time, clickable room (`focusRoomByCode`), organizer chip, "More info ↗" (`event.url`). |

`CampusMapView.tsx` change: swap `<LandmarkPicker />` for `<MapSidePanel />`, and add
`<EventLayer />` alongside `<MapCanvas />`. `placesPanelRef` continues to feed `EdgeIndicators`
as an occluder.

## Interactions & states

- **Hover a pin** → mini speech-bubble (title + date/time) appears above it; cursor pointer.
- **Click a pin** → map flies to it, pin gets a halo, bottom-left `DetailPanel` shows the event card.
- **Click a list row** → identical to clicking its pin (shared `focusEventById`).
- **Click the room link** in the detail card → `focusRoomByCode(roomCode)` enters the building/floor.
- **All / My faculty toggle** → filters both the list and the visible pins.
- **Clustering:** events whose coords are within a small pixel threshold collapse into one pin
  with a count badge; clicking it lists those events (reuse the landmark-clustering helper pattern).
- **Empty state:** no events for the active filter → friendly empty panel (mirrors `EventsDropdown`).
- **Loading:** pins and list render once `mapEvents` resolves; skeleton/`events.loading` string reused.
- **Mobile:** the right panel and detail card follow existing CampusMap responsive behaviour; pins
  remain tappable (tap = click). Mini speech-bubble is skipped on touch.

## Testing (test-first)

- `createMapSlice` test: `setEventFilter`, `setMapPanelTab`, `focusEventById` sets an `event`
  selection + bumps `mapFocusRequest`; unpinnable event is a no-op focus.
- `mapEvents` mock provider: decorates events, leaves `coord: null` for online venues, produces
  stable ids.
- `EventsList`: filter toggle changes rendered rows; unpinnable row carries the tag and does not
  call focus; empty state renders.
- `EventLayer`/clustering helper: co-located events collapse to one pin with the right count;
  pinnable count excludes `coord: null`.
- `MapSidePanel`: tab switch swaps content; default tab is `places`.

## Explicitly out of scope (deferred to backend phase)

- The organizer-side map picker for choosing an event's coordinate.
- Real event source / persistence / auth for organizers (the society catalog + events are static).
- Notifications, RSVP, or any write path.
- Society *membership/following* model — for now societies are a fixed catalog of three; the
  filter is faculty-based, not per-society subscription.

## Open assumptions (flag if wrong)

1. The bell/`EventsFeed` stays unchanged and coexists with the map surface.
2. **Venue assignment is inferred.** The society calendars (ESN/SU PEF/AU FRRMS) give real titles
   and dates but **not** venues. We pin each event to its society's home base (SU PEF→Q,
   AU FRRMS→FRRMS, ESN sport→Tauferovy sports centre, ESN socials→JAK) and mark trips / pub /
   tram / ball events as off-campus list-only. Real coords will come from the organizer picker later.
3. Recurring annual society events are positioned into the **current/next-year window** so the
   demo isn't empty; titles are kept verbatim from the real calendars.

## Appendix — mock dataset (real society events)

Source: ESN MENDELU, SU PEF (`HARMONOGRAM LS 2025/2026`), and AU FRRMS (`au_frrms`) public
calendars. Titles/dates are real; venue/coord per assumption #2.

**SU PEF (`#0046a0`, Q building):** Filmový klubík · PEF Kvíz · Deskovky · Beer Pong (Q) ·
TINDELU · Sportem ku zdraví · Tour de Pub *(off-campus)* · Únikovka *(off-campus)*

**AU FRRMS (`#c32897`, FRRMS):** ASY-Quiz (Akademické středy) · NEON Party (Půlení semestru) ·
Taiwanský den (Tématické dny) · Deskovky · Karaoke Night

**ESN MENDELU (`#00AEEF`):** Erasmus Cup: Basketball · Erasmus Cup: Volleyball *(Tauferovy sports
centre)* · Beerpong · BU Karaoke *(JAK)* · Country Presentation *(Q / Aula)* · Pub Quiz · Tram
Party · Int'l Student Ball · Trip to Ostrava · Trip to Olomouc *(off-campus list-only)*
