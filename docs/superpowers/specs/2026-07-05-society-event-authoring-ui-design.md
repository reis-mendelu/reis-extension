# Society Event Authoring UI — Design Spec

Status: design in progress (UI-first prototype; backend deferred). Date: 2026-07-05.
Prototype (mock, no backend): Artifact at https://claude.ai/code/artifact/ced3ecde-1729-48f9-a5a5-d5081491137a
Prototype source (ephemeral, not committed): `$CLAUDE_JOB_DIR/tmp/create-event-prototype.html`.

## Goal
Let a society contact author campus events **on the same map students read**, so authoring is as vivid/clear as consumption. Replaces the bare `SocietyPostManager` shell (a placeholder form).

## Decisions (locked with the user)

1. **Entry = a Student ↔ Society mode toggle** on the campus map, shown only when signed in as a society (the "Spravovat spolek" trigger becomes "enter Society mode"). Students never see society controls.

2. **Create flow = on the map, click-to-place.**
   - Fields: **name**, **date** (calendar picker), **place**.
   - Place: press **"Select place"** → the map arms (banner "click the map where your event is") → **click the exact spot** → pin drops there. **No dragging.** "Change place" re-arms.
   - This **eliminates geocoding** — the society gives us coordinates by clicking. (Optional venue *name* text label could be added later; placement stays click-based.)
   - Category/venue-kind/time/end-date/url from the existing model are **deferred** (kept simple: name + date + place). The data model already supports them if we re-add.

3. **Rolling public window + scheduled events.**
   - The public map/feed shows only a rolling **this-week + next-week** window (by date). Past events age out for everyone; nobody manages old events.
   - A society may pick **any** date. An event more than ~2 weeks out is **"scheduled"**: it is NOT on the public map yet and **auto-goes-live ~2 weeks before** its date (purely by date — the society never sets a publish date or manages visibility).
   - In **Society mode**, the society sees its own scheduled events as **faded/dashed pins** ("goes live 1 Aug"); students don't. When the date enters the window the pin becomes solid + public automatically.

4. **Society mode panel = "My events"** (replaces the public "Akce" list in this mode):
   - Sections **Live now / Scheduled / Past**, each event card with stats.
   - **Create** button here. Click a live/scheduled event → **highlight it and bring the map to it** (fly/recenter beside the panel), then edit/delete. Click a pin → same.
   - **No coordination view** — the society does NOT see other societies' events (decided: coordination adds little; focusing the selected event is what matters). Student mode still shows everyone's live events.

5. **Edit / delete**: click your own pin (or panel card) → popover with Edit / Delete. Edit reopens the composer prefilled; changes are live. Delete removes it.

6. **Past events → private analytics.** Past events leave the public map but persist in Society mode → **Past** with engagement: **views + link-opens** (DB already has `view_count`, `click_count` + increment RPCs), e.g. "312 saw · 41 opened link".

7. **Public "Jdu" / interest (separate layer, phased).** A public social-proof signal on live events ("42 jdou"), visible to all students, built on the existing `RsvpSlice`. Complements (does not replace) private analytics — it feeds it (said they'd go vs clicked). Prototype/implement after the core Society-mode surface.

## Visual language
Native to reIS: dark app chrome, **always-light map**, society-blue accent (SUPEF `#0046a0`), reIS-green (`#79be15`) for the single Publish action. Society colours from `src/data/societies.ts`. Signature moment = the click-to-place pin drop with the live student's-eye label (the pin *is* the student view).

## Reused / existing infrastructure
- Data model complete: `PostInput`/`spolky_events` already carry title, body, category, date, endDate, time, venueKind, roomCode, coordLng/Lat, location, url. Authoring is **UI-only** — no schema/API change to expose the current fields.
- `societyById` / `SOCIETIES` (`src/data/societies.ts`) for colours/glyphs (incl. the new `reis` entry).
- Campus map: `EventLayer`, `eventHelpers` (`groupEventsByVenue`, `weekSections`), `createMapSlice` (`loadMapEvents`, `focusRoomByCode`, `roomCodeToCoord`), Leaflet instance (real `flyTo` gives us the "bring the map to it" for free).
- `view_count` / `click_count` + increment RPCs; `RsvpSlice` for "Jdu".

## Backend phase (deferred — task #12)
- Auth-gate Society mode to logged-in society; wire Create/Edit/Delete to `createPost`/`updatePost`/`deletePost` (`src/api/societyPosts.ts`, `adminAuthClient`).
- Public map/feed window filter: `today <= date <= end-of-next-week` (hides past + far-future); society's own view shows all their upcoming incl. scheduled.
- Click → store `coord_lng/lat` directly (no geocoding). `venue_kind='offcampus'` when placed by coord (or a new "point" venue), so the existing venue check constraints are satisfied.
- Wire "Jdu" to `RsvpSlice`; surface `view_count`/`click_count` in the Past section.

## Open / to revisit
- Optional venue *name* text label alongside the click-placed coordinate.
- Whether to re-add category (drives feed emoji + map type filter) — currently dropped for simplicity.
- Mobile layout of the Society panel (bottom-sheet).
