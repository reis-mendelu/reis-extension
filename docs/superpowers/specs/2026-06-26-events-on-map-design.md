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
| Pin resting look | **Thumbnail pin** — event poster image in a faculty-coloured ring; falls back to an icon when no image |
| Pin hover | Mini speech-bubble (title + date/time) above the pin |
| Pin click | Flies the map to the pin + opens full event card in the **bottom-left detail panel** |
| List placement | **Tabbed right panel** — the existing top-right "Places" panel gains `Events / Places` tabs |
| Scope | **All faculties** by default, with an **All / My faculty** filter toggle |
| Location model | Each event carries an **explicit `[lng, lat]` point** (organizer-picked later). No dependency on lazily-loaded room geometry |
| Time window | Events in the **current and next calendar year**, soonest first |
| Unpinnable events | An event with no coordinate is **list-only**, flagged (`online` / `off-campus`); no map pin, clicking does not fly |

## Data model (mocked for this pass)

Extend the existing `MendeluEvent` rather than replace it. New optional fields are populated
by a mock provider now and by the real backend later.

```ts
// src/types/events.ts — additions
export interface MapEvent extends MendeluEvent {
  id: string;                       // stable key (mock: hash of url+date)
  coord: [number, number] | null;   // [lng, lat]; null = unpinnable (list-only)
  roomCode: string | null;          // e.g. "Q01" — display + "fly there" affordance
  venueKind: 'campus' | 'online' | 'offcampus';
}
```

`organizerKey` (faculty) already exists and supplies the ring colour via `ORGANIZERS[key].color`.
"My faculty" reuses `useEventsFacultySettings` (the user's home faculty is already derived there).

**Mock provider:** `src/api/mapEvents.ts` exposes `fetchMapEvents(language)` returning
`MapEvent[]`. For this pass it wraps the existing `fetchEvents` output and decorates a handful
with realistic `coord`/`roomCode` values drawn from `rooms-index.json` building centroids, plus
one or two `online` examples. This is the single seam the real backend replaces.

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
- Real event source / persistence / auth for organizers.
- Notifications, RSVP, or any write path.
- "Society" as a first-class entity beyond the existing faculty `organizerKey`.

## Open assumptions (flag if wrong)

1. The bell/`EventsFeed` stays unchanged and coexists with the map surface.
2. Reusing `organizerKey` (faculty) for colour + "My faculty" is sufficient identity for now;
   no separate club/society model is introduced in this pass.
3. The mock provider may reuse `fetchEvents`; we are not changing the existing events pipeline.
