# Society Map Events: Location Model & Creation Flow

**Status:** Approved for planning
**Date:** 2026-07-03
**Repos touched:** `reis-extension`, `reis-admin`, Supabase project `reis-notifications` (`zvbpgkmnrqyprtkyxkwn`)

## Problem

The campus map's events feature (blue building polygons, "Akce" sidebar, society filter chips) is currently a UI-complete prototype running entirely on hardcoded mock data (`src/api/mapEvents.ts`, `SEEDS` array). There is no way for a student society ("spolek") to actually create an event, and no data model or UI exists for the two location types real events need: a specific room inside a specific campus building, or a free location anywhere in the city (e.g. a tram-stop meetup). This design moves the feature from prototype to production: real society-authored events, with both location modes, replacing the mock data entirely.

## Current state (from codebase audit)

- **`MapEvent`** (`src/types/events.ts`) already has the exact shape this feature needs: `coord: [lng,lat] | null`, `roomCode: string | null`, `venueKind: 'campus' | 'online' | 'offcampus'`, plus the inherited `MendeluEvent` fields (`title`, `url`, `date`, `endDate`, `time`, `location`, `imageUrl`, `organizerKey`). No type changes are required.
- **On-campus room resolution is already solved**: `src/data/map/buildings.json` + a rooms index give every room a polygon; `polygonCentroid()` (`mapHelpers.ts`) already derives a coordinate from any polygon. A "pick building → pick room" UI needs no new backend.
- **Off-campus placement is a genuine gap**: no click-to-place-pin or geocoding exists anywhere in either repo today. Mock off-campus events use hardcoded lat/lng literals.
- **Auth is already solved and reusable**: `spolky_accounts` (Supabase table, 7 rows) gives each society one Supabase Auth login, admin-provisioned (not self-signup), with `association_id`/`role` columns. The existing `notifications` feature already uses this exact pattern — RLS scoping writes to the caller's own `association_id` — end to end, in production, in `reis-admin`.
- **`spolky_accounts.association_id` values**: `af`, `au_frrms`, `esn`, `ldf`, `reis` (internal admin, not a society), `supef`, `zf` — six real student associations. The extension's static `Society` catalog (`src/data/societies.ts`) currently only has visual assets (color/glyph/logo) for three of them (`esn`, `supef`, `au_frrms`).
- **`reis-admin`** (Vercel dashboard) has zero map/Leaflet dependency and zero society/event management today, but already has the authenticated society session and a near-identical "create notification" form to clone.
- Both the location-gap audit and the frontend-design audit independently flagged the same open risk: no moderation/validation exists for an organizer-submitted location before it renders next to previously-trusted data.

## Decisions

| Question | Decision |
|---|---|
| Where do organizers create events? | `reis-admin` dashboard (not the extension). Reuses existing auth; extension gets no new login surface. |
| Moderation of organizer-submitted locations? | None for v1 — `spolky_accounts` are already admin-provisioned, vetted accounts. Revisit only if abuse occurs. |
| City-pin location input? | Both click-to-drop-pin on a map **and** typed-address search (Nominatim/OSM, Brno-bounded, free, no key). |
| Room/pin picker UI in `reis-admin`? | A real embedded Leaflet map (not a text-only dropdown), reusing the same building/room GeoJSON data as the extension, so organizers get the same visual placement experience as the student-facing map. |
| Society scope? | All 6 real associations (`af`, `au_frrms`, `esn`, `ldf`, `supef`, `zf`) get event-creation access — the map is moving from prototype to production, so catalog coverage should match the real account list. `reis` (internal admin) is excluded. |
| Event images? | Out of scope. No upload capability. Pins fall back to the society's existing `logo`/`glyph`, which `EventPin` already supports for `imageUrl: null`. |
| Mock data after launch? | Removed entirely. `fetchMapEvents` becomes a real query; an empty table renders an empty map, which is correct production behavior. |
| Edit/cancel after publish? | Included in v1 — a lightweight per-society events list with edit/delete, alongside the create form. |
| Data model shape | A single `spolky_events` table with a mode discriminator (`venue_kind` + `room_code` + `coord` + `location`), not normalized placement tables and not a lat/lng-only minimal schema. This is a 1:1 match for the existing `MapEvent` type and preserves the existing "fly to room" affordance. |

## Data model

New Supabase table `spolky_events` (project `reis-notifications`):

| column | type | notes |
|---|---|---|
| `id` | uuid PK, default `uuid_generate_v4()` | |
| `association_id` | text | matches `spolky_accounts.association_id`; who authored the event |
| `title` | text | |
| `category` | text | check constraint against the `EventCategory` union (`party`, `boardgames`, `trip`, `quiz`, `sports`, `film`, `karaoke`, `culture`, `social`, `other`) |
| `date` | date | |
| `end_date` | date, nullable | |
| `time` | text, nullable | mirrors `MendeluEvent.time` |
| `venue_kind` | text | check constraint: `'campus' \| 'online' \| 'offcampus'` |
| `room_code` | text, nullable | set only when `venue_kind = 'campus'` |
| `coord_lng` | double precision, nullable | resolved room centroid, or dropped-pin/geocoded point |
| `coord_lat` | double precision, nullable | |
| `location` | text, nullable | free-text label: typed address or manual description |
| `url` | text, nullable | mirrors `MendeluEvent.url` |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()` | |

No `image_url` column.

**RLS**, copied from the existing `notifications` table's working pattern:
- `insert`/`update`/`delete`: only rows where `association_id` matches the caller's own row in `spolky_accounts` (resolved via `auth.jwt()->>'email'`), and that account is `is_active`.
- `select`: public (`anon` role) — the extension has no student-side auth, and event data is not sensitive.

**Society catalog**: `src/data/societies.ts` grows from 3 to 6 entries, adding `af`, `ldf`, `zf` alongside the existing `esn`, `supef`, `au_frrms`, each with a `color`/`glyph`/`logo` following the existing entry shape. Logo images already exist at `public/spolky/{af,ldf,zf}.jpg` — this is a pure data addition, no new asset sourcing needed.

## `reis-admin` creation UX

New feature module `src/features/events/`, added as a nav item alongside the existing `notifications`/`users`/`study-jams` modules, cloned from the existing "create notification" form's session/`association_id`/submit scaffolding.

**New dependencies**: `react-leaflet` + `leaflet`, plus the campus `buildings.json`/rooms-index/`landmarks.json` data (shared with `reis-extension`; exact sharing mechanism — copy vs. build-time symlink vs. a small shared package — is an implementation-plan decision, not a design decision).

**Form flow**:
1. Title, category, date/time, optional end date, optional url — plain fields.
2. **Location mode toggle**: a `join` of two `btn-sm` buttons ("Na kampusu" / "Ve městě"), matching the existing society-filter-chip active/ghost convention. Not tabs or a wizard — this is one field with two input strategies, not independent content panels.
3. **Campus mode**: embedded Leaflet map with the same blue building polygons as the student map. Click a building → dropdown of that building's rooms (friendly `label` shown first, code like `Q01` shown secondary) → selecting a room applies the existing orange "selected" polygon highlight and resolves `room_code` + `coord` via `polygonCentroid()`.
4. **Off-campus mode**: same map, building polygons inert. Organizer either clicks anywhere to drop a pin (a distinct marker color/glyph — never the room-selection orange, so the two modes are never visually ambiguous) or types an address into a Brno-bounded Nominatim search box that resolves to a draggable pin for fine-tuning. Either path fills `coord` + `location`.
5. Submit inserts into `spolky_events`; RLS enforces the `association_id` scope server-side (no client-side trust required).

**Events list**: each society sees their own published events (a simple table/list, matching the existing `users`/`notifications` list patterns) with edit and delete actions, reusing the same form for edit.

**Visual constraint carried over from the student map**: the basemap is always light regardless of app theme (established constraint, see `campus-map-always-light-basemap` design history) — all new picker styling (selection highlight, pin colors) must use fixed hex literals tuned for a light background, not DaisyUI theme tokens, matching how `mapHelpers.ts` already does it.

## `reis-extension` read-side changes

- `src/api/mapEvents.ts`: the mock seam (`SEEDS` array and its relative-date "never looks empty" logic) is deleted. `fetchMapEvents(language)` becomes a real `select * from spolky_events` (public/anon read), mapping `venue_kind`/`room_code`/`coord_lng`+`coord_lat` back into the existing `coord: [lng,lat] | null` shape.
- No changes needed to `EventPin.tsx`, `EventDetailCard.tsx`, `EventLayer.tsx`, or the fly-to-room click affordance — they already consume the `MapEvent` shape this produces.
- A failed fetch degrades to an empty events list plus a `logError` call (`Api.fetchMapEvents` context, per the existing telemetry convention), not a broken map.

## Testing

- `reis-admin`: unit tests for the location-mode resolution logic (room→coord via centroid, pin/address→coord) and for RLS-scoped create/update/delete, written before implementation per this repo's test-first convention.
- `reis-extension`: update `mapEvents` API tests to assert against the new Supabase-backed path instead of `SEEDS`. No changes expected to existing `EventPin`/`EventDetailCard` component tests since the `MapEvent` contract is unchanged.
- No Playwright E2E coverage of the `reis-admin` Leaflet picker is in scope for v1 (this repo's E2E suite targets `reis-extension`, not `reis-admin`).

## Explicitly out of scope for v1

- Event image upload.
- Admin moderation/approval queue for organizer-submitted locations.
- In-extension (as opposed to `reis-admin`) event creation.
- E2E test coverage of the new `reis-admin` picker UI.
