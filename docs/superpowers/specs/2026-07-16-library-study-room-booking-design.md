# Library study-room booking on the campus map — design spec

- **Date:** 2026-07-16
- **Status:** Approved design, ready for implementation plan
- **Scope:** v1 = live availability + deep-link-out to book (Path A). In-app booking (Path B) is a later phase, out of scope here.
- **Owner context:** Built at the MENDELU library's request. The library runs a Microsoft Bookings page for its study rooms; reIS surfaces those rooms on the existing campus map with live "next bookable slot" status and a one-tap booking deep-link.

## 1. Goal

Let a student open the reIS campus map, see the library's study rooms with a live indication of when each can next be booked, and reach the correct Microsoft Bookings page in one tap. Secondary goal (the collaboration flywheel): give the library visibility on the map and a click-through number that later justifies deeper (Graph API) integration.

## 2. Key decision — why Path A

The booking backend is **Microsoft Bookings** (tenant `RezervacestudovenMENDELU@mendelu.onmicrosoft.com`), a closed iframe with no shared DB. Three integration paths were considered:

- **A — Anonymous public Bookings API (chosen for v1).** The public booking page reads rooms and availability from an undocumented but **anonymous** REST API (no login, no admin consent). Verified live. Read-only.
- **B — Microsoft Graph (app-only).** Official/stable; supports reading availability *and* creating bookings, but every Bookings scope requires **MENDELU tenant-admin consent** (confirmed: the page owner is not a tenant admin). Deferred.
- **C — Deep-link only.** A "book" button with no availability. Retained as Path A's built-in fallback.

Path A ships without anyone's permission and shares its architecture with Path B (a cached edge-function proxy → extension). Swapping A's data source for Graph later is a localized change, not a rewrite. The physical **key is collected at the library desk against a student card**, so even Path B's "book fully in-app" only removes a browser tab — availability is where the student value is.

## 3. The booking system (verified facts)

**Anonymous c2 API base:**
`https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/`

All calls return `200` with **no auth, no cookie, no CSRF/canary token**:

| Call | Method | Returns |
|---|---|---|
| `/` | GET | business info: `businessHours`, `schedulingPolicy` |
| `/bookingsSettings` | GET | tenant booking settings |
| `/services` | POST `{}` | `service[]` — the bookable rooms (title, `serviceId`, `webUrl`, `staffMemberIds`, `defaultDuration`, `bookingsSchedulingPolicy`) |
| `/staffmembers` | GET | `staffMember[]` — room *resources* (GUEST role) **and real librarian names** (ADMINISTRATOR role) |
| `/GetStaffAvailability` | POST | bookable slots for given staff GUIDs + time window |

**Scheduling rules (per room, from the API):**

| Room(s) | Min lead time | Max advance | Slot / duration |
|---|---|---|---|
| 6 study rooms (Individual/Team/IC) | **1 hour** | 60 days | 1 h |
| Seminar Room | **2 days** | 60 days | 1 h |

- Business hours **Mon–Fri 08:00–16:00**, hourly slots.
- From the library rules page: reservation held only **15 min** past start; **1 h** per booking (chain several for longer); **max 3 recurring** slots; **Seminar Room only for groups of 10–18**; key pickup at the desk against ISIC/staff card.
- Consequence for UX: there is **no "book right now"** — the earliest reservable slot is ≥1 h out (≥2 days for the seminar room). The status we show is **"next bookable slot,"** never present-tense occupancy.

**Known unknown (first implementation task):** the exact `GetStaffAvailability` request body and response schema were not captured (the public page issues it from a web worker). We now have the staff GUIDs, so step 1 of implementation is to replay it with a known `staffId` + date window and record the request/response shape. Everything else below is verified.

**ToS / stability note:** this endpoint is undocumented and unsupported; Microsoft could change or block it. Mitigations: server-side proxy (single hot-fix point, no extension re-release needed), short cache, and graceful degradation to Path C. This is an accepted, contained risk for v1.

## 4. Data model

### 4.1 The 7 rooms — authoritative join (all in building A, floor `57574`, level −1)

| Service (EN) | Room resource (CZ) | Staff GUID | placeId | Passport | Capacity | Lead |
|---|---|---|---|---|---|---|
| Team Study Room 1 | Týmová studovna 1 | `e9c87efa-0ea7-4d3e-9f9a-9e51c5775474` | 57632 | BA01P1049 | 10 | 1 h |
| Team Study Room 2 | Týmová studovna 2 | `ee81403d-0312-49e8-a9cd-bca3be101c32` | 57627 | BA01P1053 | 6 | 1 h |
| Individual Study Room 1 | Individuální studovna 1 | `38efbb39-7a31-4526-bb7e-c34504f1a539` | 57621 | BA01P1052 | 2 | 1 h |
| Individual Study Room 2 | Individuální studovna 2 | `cb31b250-257c-45f5-a79e-957300aea3a6` | 57625 | BA01P1051 | 2 | 1 h |
| Study Room IC 1 | Studovna IC 1 | `2e10ced2-1057-46c5-a2df-ef90fc1ecdcc` | 57640 | BA01P1012 | 6 | 1 h |
| Study Room IC 2 | Studovna IC 2 | `548315e4-e230-44ab-b23b-19a643c2d03c` | 57640 *(shared)* | BA01P1012 | 6 | 1 h |
| Seminar Room | Seminární místnost | `ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a` | 57631 | BA01P1047 | 10–18 | 2 d |

- Library grouping: rows 1–5 + 7 = **Knihovna A**; rows 6–7 IC = **Knihovna IC** (physically also in building A, floor −1, per the owner).
- `placeId` == the geojson `feature.id` in `reis-data/map/rooms-54678.geojson` (verified). Room polygons carry `seats`/`hasProjector`/`hasWhiteboard`.
- All rooms have PC + power socket + Wi-Fi.

### 4.2 `src/data/map/libraryRooms.ts` (new, ~7 rows — the only hand-authored data)

Static mapping keyed by **staff resource GUID** (stabler than title):

```ts
export interface LibraryRoom {
  staffGuid: string;      // join key to /services → staffMemberIds[0]
  library: 'A' | 'IC';    // Knihovna A | Knihovna IC
  buildingId: 54678;
  floorId: 57574;
  placeId: number;        // room polygon to highlight/anchor
  capacity: number | [number, number]; // 10, or [10,18] for seminar
}
```

Dynamic per-room data (`serviceId`, `webUrl`, `leadTime`, availability) is **not** hardcoded — it comes from the proxy at runtime, so it can't drift from the Bookings config.

## 5. Architecture

```
Microsoft Bookings (anon c2 API)
        ▲  server-side fetch, no secret
        │
Supabase edge fn: bookings-availability   ← caches ~60s, single hot-fix point
        ▲  shared-secret gated (x-reis-extension-secret)
        │
reIS extension: api/libraryAvailability.ts → createMapSlice → map UI
```

### 5.1 Edge function `bookings-availability` (new)

- Pattern: mirror `supabase/functions/google-oauth` (Deno, `verify_jwt=false`, `x-reis-extension-secret` gate).
- On request: call `/services` + `/staffmembers` + `/GetStaffAvailability` (window `now → today 16:00` per staff GUID), compute the **next bookable slot** per room, and return a normalized payload. Cache the upstream result ~60 s (shared across all students → respects Microsoft's strict 4-concurrent Bookings limit; kinder than every client polling).
- Response shape (normalized, per room):

```ts
interface RoomAvailability {
  staffGuid: string;
  serviceId: string;
  webUrl: string;               // per-room booking deep-link
  nextSlot: string | null;      // ISO; null = nothing bookable today
  bookableToday: boolean;
  leadHours: number;            // 1 for study rooms, 48 for seminar
}
```

- **Do not reimplement scheduling-policy math.** Prefer the slots `GetStaffAvailability` already returns as bookable (the same set the public page renders); pick the earliest. Clamp to business hours only as a safety net.
- **Filter out ADMINISTRATOR-role staff** — never expose librarian names.

### 5.2 Extension data flow

- `src/api/libraryAvailability.ts` (new) — thin fetch fn to the edge fn (follows `src/api/campusMap.ts` conventions).
- Fetch is **lazy, on library-zone open** (same trigger style as `fetchBuildingRooms`), not on a timer. Result held in `createMapSlice` as a small `Record<staffGuid, RoomAvailability>` with a ~60 s in-memory freshness memo. No IndexedDB (availability is ephemeral).
- No new store, no new `AppView`.

### 5.3 "Next bookable slot" display logic (pure, unit-tested)

Given a `RoomAvailability` + `now`:
- `nextSlot` today and >now → **"Volno od HH:MM"**.
- `bookableToday === false`, study room → **"Dnes plno · zítra od 08:00"**.
- Seminar Room (leadHours 48) → **"Rezervace 2 dny předem"** (never a today answer; visually set apart).
- Availability missing (proxy failed) → hide status, keep the book button (**degrade to Path C**).

## 6. UX / UI

**Entry point:** an aggregate **"Knihovna · N volné dnes"** pin on the campus overview (passive discovery = library visibility). Tapping it reveals a compact list of the 7 rooms with their next-slot status; selecting a room `flyAndReveal()`s to building A / floor −1, tints the room polygons by status, and opens the room detail card.

**Room detail card** (extends the existing room `DetailPanel`): room name, capacity, amenities (PC / socket / Wi-Fi), the library rules (15-min hold, 1 h, chain-for-longer, seminar 10+), the live next-slot status, and a **"Rezervovat"** button = `<a href={webUrl}>` (per-room Bookings deep-link).

**Copy:** Czech-first, sentence case, active voice, via `useTranslation()`. Status strings never imply real-time occupancy — always "next slot."

## 7. Component reuse map

| Feature piece | Reuse (exists) | Net-new (tiny) |
|---|---|---|
| Overview pin | `EventLayer.tsx` projection + `EventPin.tsx` visual (the `reisEvents` Leaflet pane) — **pattern, not the society data model** | small parallel `LibraryLayer` fed from availability |
| Tap → room list | `EventsList.tsx` / `EventRow.tsx` / `EventDetailCard.tsx` styling | `StudyRoomList` (7 rows + status badge) |
| Fly + select | `flyAndReveal()` (`mapLayers.ts`), `selectMapRoom` + `focusReq` (`createMapSlice.ts`) | wire click → focus A/floor −1 + select `placeId` |
| Rooms tinted by status | `MapCanvas.tsx` redraw effect + `mapHelpers.ts` styles | status→style map for the 7 `placeId`s |
| Room detail card | `DetailPanel` + `RoomThumbnail.tsx` | library section (capacity/amenities/rules/next-slot/Rezervovat) |
| Book button | existing `openLink` / external-link handling | `href = webUrl` |
| Availability fetch | `api/campusMap.ts` fetch pattern + lazy fetch-on-open | `api/libraryAvailability.ts` |
| State | `createMapSlice.ts` (selection/focus) | `Record<staffGuid, RoomAvailability>` + 60 s memo |
| Backend | `functions/google-oauth` edge-fn pattern | `functions/bookings-availability` |
| i18n | `useTranslation()` + `locales/{cs,en}.json` | ~8 strings |
| Analytics | `increment_post_click`-style RPC / `daily_active_usage` | one Rezervovat click counter |

**Deliberate non-reuse** ("reuse where it fits"): library data does **not** flow through the society `EventLayer`/`spolky_events` model — study rooms aren't a society domain. Reuse the Leaflet-pane + projection *mechanism* in a small `LibraryLayer`, not the semantics.

## 8. What to avoid (simplicity guardrails)

- **No new tab / `AppView`.** Lives inside the existing map.
- **No calendar / time-grid / slot-picker.** We show one next-slot line + a deep-link. Rebuilding the booking flow is the biggest trap.
- **No polling.** Cache 60 s at the proxy; fetch on zone open.
- **No over-modelling.** No reservations table, no accounts, no write path in v1.
- **No custom CSS.** DaisyUI semantic classes only (Iron Rule).
- **No bespoke pins/cards.** Match `EventPin` / `DetailPanel`.
- **Never leak librarian names** (the `/staffmembers` ADMINISTRATOR rows).
- **Failure must not read as "no rooms."** Missing availability → hide status, keep book button.

## 9. Privacy & security

- Anonymous, read-only API — no student data sent to Microsoft; no secrets in the bundle.
- Edge fn is shared-secret gated and holds no credentials (the upstream is anonymous).
- ADMINISTRATOR-role staff filtered server-side.
- Note to library (owner action, not code): the `/staffmembers` endpoint publicly exposes librarian names; their call whether to accept.

## 10. Error handling

- Proxy upstream fails / schema drift → edge fn returns `nextSlot: null` (or 503); UI degrades to Path C (book button only), no error surfaced to the student.
- `logError('Api.libraryAvailability', …)` on fetch failure (existing telemetry pipeline). No IS/booking data in telemetry (sanitizer already covers `*.mendelu.cz`).

## 11. Analytics (the library giveback)

Count "Rezervovat" click-throughs (reuse the `increment_post_click` / `daily_active_usage` pattern). This number is the evidence for the later MENDELU IT ask that unlocks Path B.

## 12. Testing (test-first)

- **Pure:** next-slot computation + response normalization from `GetStaffAvailability` fixtures (Vitest). Seminar-room 2-day case, "plno dnes" case, degraded case.
- **Data integrity:** every `libraryRooms.ts` entry's `placeId` exists in `rooms-54678.geojson`; every `staffGuid` is present in a captured `/staffmembers` fixture.
- **Edge fn:** manual/integration against the live anon API (record a fixture first).
- **UI:** thin — status string per state; degraded state keeps the book link.

## 13. Future — Path B (out of scope, noted)

Same proxy + UI skeleton. Swap the edge fn's upstream to Microsoft Graph app-only (`getStaffAvailability` + `POST appointments`) after MENDELU IT consents an Azure app. Adds true in-app booking (create appointment, with business-rules validation and confirmation-email handling). No client rewrite.

## 14. Open questions / risks

1. `GetStaffAvailability` request/response schema — capture first (we have the GUIDs).
2. Does the c2 availability response already honor lead time & business hours, or must the proxy clamp? Resolve during (1).
3. Entry point confirmed as overview pin; revisit if it feels too prominent in the map overview.
4. Per-room `webUrl` deep-links verified for all 7 — confirm they land on the room-scoped booking step (not just the list).

## Appendix — raw API reference

- Base: `https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/`
- `GetStaffAvailability` body (Graph analog, to verify against c2): `{ staffIds: [guid], startDateTime: {dateTime, timeZone}, endDateTime: {dateTime, timeZone} }`
- Business hours: Mon–Fri `480`–`960` (minutes) = 08:00–16:00. Timezone: Europe/Prague (Central Europe).
- Per-room `webUrl` form: `https://outlook.office.com/book/{mailbox}/s/{code}`.
