# Society events: a full semester catalog, with or without a place

**Date:** 2026-09-28
**Status:** design approved in chat, awaiting spec review
**Follow-up:** spec 2 (reminders for followed societies). It is out of scope
here, and section 6 lists what this spec must not break for it.

## Problem

Societies do not post events themselves. Production on 2026-09-28 has 6 rows in
`spolky_events`, 5 of them real, and all 5 were posted by `reis_admin` on a
society's behalf. The 7 society accounts are four weeks old and none of them
has posted. There are 0 upcoming events, while map use is growing (20–25
installs a day open it for 3 s or more).

What societies do have is a semester list. ESN MENDELU Brno publishes its
winter-semester poster with about 40 public events, each with a title and a
date but **no time and no venue**. No society publishes events in a
machine-readable form (no ICS, no schema.org, no API), and scraping Facebook or
Instagram breaks Meta's terms. Importing the lists by hand, with the societies'
consent, is the only route.

reIS cannot hold such an event today:

- The database requires a room (`campus`) or coordinates (`offcampus`), via
  `spolky_events_venue_kind_check` and `spolky_events_offcampus_coords_chk`.
- The composer requires a time and a coordinate (`EventComposer.tsx:93`) and
  cannot save anything else.
- An event appears only 14 days before its date (`PUBLIC_WINDOW_DAYS`,
  `eventWindow.ts:6`), so an imported semester would trickle in 13 days before
  each date. Students could not plan, and ESN trips with early sign-up would
  show after sign-up closed.

## Goal

A student opens reIS and sees every upcoming event of the semester, nearest
first, even when the place and time are not known yet. It is clear where to
find out more (the society's Instagram). The society can fill in the place
later.

## Non-goals

- Reminders and notifications, and the follow button: spec 2.
- Importing automatically from Instagram, Facebook or activities.esn.org.
- Crediting mendelu.cz events (balls, Prvákoviny) to societies. The MENDELU
  events feed (`EventsFeed`, `useEventsFeed`) is rendered nowhere today, so this
  is a pipeline merge, not a scraper tweak.
- Recurring series (BU Karaoke every other Monday). These are imported as
  separate rows.
- Poster images on events.

## Decisions (made in chat, 2026-09-28)

1. **Place not known is a first-class state:** a new `venue_kind = 'tba'`.
   Rejected alternatives:
   - `offcampus` without coordinates. It is false for a pub quiz held on
     campus, and it hides which events still need a place.
   - A default pin per society. It would show a precise pin that is wrong.
2. **The society's Instagram is the "details" link** whenever an event has no
   URL of its own.
3. **Internal events are never imported,** for any society. For ESN these are
   Team meeting, Local Boards Training, Teambuilding, CEP, CM, NA, Newbies event
   and Christmas teambuilding.
4. **Supply first.** Phase 1 is database-only, so it reaches every installed app
   without waiting for a release.
5. **The 14-day window goes, for the catalog.** This reverses what was said
   earlier in the chat. The research found no product that hides upcoming
   events. The follow loop in spec 2 also needs an event to be visible from the
   moment it is posted.

## Phase 1: database and import, no release

### 1.1 Migration `20260928120000_spolky_events_tba_and_instagram.sql`

```sql
alter table public.spolky_events drop constraint spolky_events_venue_kind_check;
alter table public.spolky_events add constraint spolky_events_venue_kind_check
  check (venue_kind = any (array['campus','online','offcampus','tba']));

alter table public.societies add column instagram text
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
comment on column public.societies.instagram is
  'Instagram handle without @. The client builds the URL; it is never stored.';
notify pgrst, 'reload schema';
```

- **Only the handle is stored, never a URL,** so nothing but an instagram.com
  link can be built from it.
- **Applied by hand** with `npx supabase db query --linked -f`. Migrations do not
  self-apply. It is dry-run first with a self-unwinding `DO` block.
- **The migration is applied on the same day its PR merges to `test`,** after
  Dominik's yes, so the repository and production never disagree for long.

### 1.2 How current clients see a `tba` row

Checked against the code. None of this needs a release:

| Surface | Behaviour on a `tba` row with `time = null`, `coord = null`, `location = null` |
| --- | --- |
| `toMapEvent` (`api/mapEvents.ts:49`) | casts `venue_kind`. Nothing branches on an unknown value. |
| `locateEvent` (`createMapSlice.ts:48`) | leaves it unpinned. Only `campus` gets resolved to a coordinate. |
| Map pins | none, because there is no coordinate. |
| Map list `EventRow` | shows the title and day. The venue line is hidden when there is neither a location nor a coordinate (`EventRow.tsx:71`). |
| `EventDetailCard` | shows the date without a time, the category and RSVP. It has no venue row and no button. |
| Novinky | shows it to followers within 14 days, as today. |
| Reminders and calendar | none, because there is no time (`plan.ts:47`). RSVP is still stored. |
| Old composer, when a society edits the row | the place and time start empty. Saving needs both, so the society has to add a place. That is acceptable until phase 2 ships. |

### 1.3 Import

- **The source is whatever the society sends:** a poster, a message or a sheet.
  Claude reads it and writes one SQL file per society into the scratchpad.
- **Rules for each row:**
  - `association_id`: the society's id.
  - `title`: as printed. Obvious typos are fixed; wording is not.
  - `date`: strictly `YYYY-MM-DD`. Days that spill over into the next month's
    grid (1 Oct, 1 Nov, 1–6 Dec on the ESN poster) are dated by their real month.
  - `end_date`: set for multi-day events (e.g. Finland 23–29 Nov, Sweden 7–13 Dec).
  - `time`, `room_code`, the coordinates, `location` and `url`: null.
  - `venue_kind`: `tba`.
  - `category`: one of the ten `EventCategory` values. The database CHECK
    enforces it.
  - `subscribers_only`: false.
  - `visible_from`: null.
  - `created_by`: `'import:2026-09-28'`, so imported rows can be traced and
    bulk-corrected.
- **Never put the Instagram URL in `url`.** A Novinky tap on an event with a
  `url` opens the link and skips the card (`useOpenNotification.ts:80`), so the
  follower would never see RSVP.
- **Only events dated from the import day onwards.**
- **Dominik sees the parsed table** (date, title, category, end date) and says
  yes before anything is inserted. The insert is one transaction per society.
- **Afterwards,** a `select` confirms the count per society and that no date
  falls on the wrong weekday.
- **Instagram handles** are filled in from officially linked accounts:
  `esnmendelubrno`, `au_frrms`, `uniestudentuaf`, `spldf_mendelu`, `led_zf`.
  The ones found only by search (SU PEF `supefmendelu`, EY) are confirmed with
  the society first.

## Phase 2: client, next release, both trees

Everything below is in shared code: `src/components/CampusMap/`, the Novinky
hook, `src/api/`, `src/store/`, and the admin console, which both trees render.
The only host-specific change is 2.6, which is Capacitor's resume handler; the
extension already rebuilds its iframe on every IS page load.

### 2.1 The catalog shows the whole semester

- **`fetchMapEvents`** drops `isPublicEvent` and keeps events that are not
  finished: `(end_date ?? date) >= today`, local day, via `eventWindow`. This is
  also bounded on the server (`.or('date.gte.<today>,end_date.gte.<today>')`),
  so the client stops downloading every past row.
- **Map list `weekSections`** gains a third bucket, `later`. It is collapsed by
  default and headed "Později (N)". The expanded state lives in the map slice
  (`mapLaterExpanded`), not in component state. `relativeDayLabel` beyond two
  weeks shows a short date ("Čt 19. 11.").
- **Pins stay limited to the next 14 days.** The map shows what is happening
  soon, and a semester's worth of pins would bury the campus. The filter moves
  from the fetch to `EventLayer`, and `PUBLIC_WINDOW_DAYS` is renamed
  `SOON_WINDOW_DAYS`, the one horizon shared by pins and Novinky.
- **Multi-day events** are judged by `end_date` for "finished", everywhere
  (list, pins, Novinky). Today a trip drops off the day after it starts.

### 2.2 Novinky keeps its 14-day horizon

- **Novinky stays a "coming soon from your societies" feed.** It is not a second
  catalog, and its view and click counters mean the same thing as before.
- **The server query** (`spolkyService.ts:66`) is bounded to
  `date <= today + 13` and the limit is raised from 50 to 200. Today it takes the
  50 soonest events of every society before the device keeps only followed ones.
  Once semesters are imported, a small society's events would fall off the end.
  Follows cannot move to the server, because they are device-only by design.
- **The start filter becomes "not finished"** (`end_date >= today` or
  `date >= today`), so a trip that is still running stays listed.

### 2.3 Place TBA and the Instagram link

- **`EventRow`:** the venue line reads "Místo upřesní {shortName}" / "Venue TBA
  by {shortName}", in muted text with no icon.
- **`EventDetailCard`:**
  - The same line appears in the venue slot.
  - **The bottom button:** the event's own `url` shows "Více informací" (as
    today). Otherwise, if the society has an `instagram`, it shows "Více na
    Instagramu" and opens `https://www.instagram.com/<handle>/` through
    `openExternal`. With neither, there is no button.
  - The file is at 199 lines, so the venue block moves out into
    `EventVenueLine.tsx`.
- **`Society` gains `instagram?: string`,** mapped in `api/societies.ts`. The
  bundled seed is left without it.
- **The admin console's `SocietyForm`** gets an Instagram field (for
  `reis_admin` only, as for every society field), validated with the database's
  regex, with a leading `@` stripped.

### 2.4 The composer accepts what societies actually know

- `ready` requires only a title and a date.
- **Time** is optional. With no time, the event is shown without one.
- **Place** is optional. With no room and no coordinate, the event is saved as
  `venueKind: 'tba'`. Adding a place later turns it into `campus` or `offcampus`.
- **An optional end date** is added for multi-day events. `composerPost.toPatch`
  now writes `end_date`, and still never writes `visible_from`.
- **The "zveřejní se <date>" note is removed,** along with `goLiveDate`, the
  authoring `scheduled` marker in `EventLayer`, and the console's "Naplánované"
  bucket. Upcoming events become one "Nadcházející" list.
- **Admin console rows** of `tba` events get a "Bez místa" badge, so a society
  can see what still needs a place.
- **The file is at 288 lines.** The validation (`ready`, the URL check, deriving
  the venue kind) moves into `composerRules.ts`, which gets unit tests.

### 2.5 Societies see who plans to come

- **`EventStats`** in the admin console shows "Zájem: N" (going plus
  interested) beside views and clicks.
- **The source is the existing public RPC `get_event_rsvps`,** which returns
  aggregates by event id. No new data flow.
- **The label says what the number is:** "Zájem v reIS", not attendance. Free
  events see a 28% median no-show rate, and RSVPs count installs, not people.

### 2.6 Freshness and a failure that hides everything

- **Capacitor `resume` reloads events** (`reloadMapEvents`) beside
  `loadSocieties`, throttled by the same gap `requestSync` uses. Today a new,
  changed or deleted event never reaches a long-lived app process.
- **A failed fetch no longer looks like "no events".** `fetchMapEvents` returns
  `null` on error. The slice then keeps the last list and leaves
  `mapEventsLoaded` unchanged, the same null-versus-empty rule `fetchNotifications`
  already follows. Reloading on resume would otherwise wipe the list on every
  network blip.

### 2.7 A Novinky tap opens the event, not the link

- **`useOpenNotification`:** when the tapped row is an event present in
  `mapEvents`, it opens the card even if the event has a `url`. The link is then
  the card's button.
- **Rows with no matching event keep opening the link:** academic rows, and a
  feed that is still loading past its retry.

## 3. Tree parity

| Change | Extension (desktop tree) | Phone/iPad (mobile tree) |
| --- | --- | --- |
| 2.1 catalog, 2.3 TBA/Instagram, 2.4 composer, 2.5 stats | yes (shared `CampusMap/`, `AdminConsole/`) | yes |
| 2.2 Novinky | yes (`NotificationFeed`) | yes (`NotificationsSheet`); same hook |
| 2.6 reload on resume | not needed: the iframe is rebuilt per IS page | yes (`capacitor/startApp.ts`) |
| 2.7 Novinky tap | yes | yes (same hook) |

Tablet width: the "Později" section and the venue line are verified at the
iPad width as well as the phone widths (`verify-ui`).

## 4. Privacy

- **No new data flow.**
  - The Instagram handle is public catalog data.
  - RSVP aggregates already come from a public RPC, and the admin console reads
    only its own society's events.
  - The fetch sends nothing new; its bound only narrows which rows come down.
- **`privacy/disclosures.ts` is unchanged.** If the `disclosure-drift` hook
  asks, this section is the answer.

## 5. Testing

- **Test first, per change:**
  - `eventWindow` (not-finished by end date, pin window)
  - `weekSections` with `later`
  - `composerRules` (`tba`, missing time, end date)
  - `toMapEvent` with `tba`
  - `fetchMapEvents` returning null on error, and the slice keeping its list
  - the Novinky query bounds and the `useOpenNotification` routing
  - the button fallback order in `EventDetailCard`
  - `SocietyForm` stripping the `@`
- **The migration:** dry-run on production in a self-unwinding `DO` block. It
  must accept a `tba` row with no coordinates, reject `venue_kind = 'foo'`, and
  reject the handle `a/b`.
- **UI:** `verify-ui` at 320, 390 and 430 px plus the tablet width on the phone
  tree, and the desktop side panel. Before/after PNGs are sent to Dominik.
  Covered cases: a TBA event in the list and on the card, "Později" collapsed
  and expanded, the composer saving without a place and time, and the console's
  "Bez místa" badge.
- **Current clients:** before the phase 1 insert, the test build with
  `dev:web`'s in-memory society store shows a `tba` row per the table in 1.2.
  This confirms the no-release claim.

## 6. What spec 2 must be able to build on

- Follows are still React state over IndexedDB (`useSpolkySettings`). Moving
  them into a slice is the first task of spec 2, not this one.
- The reminder planner keeps its own horizon. With the catalog widened, spec 2
  schedules only the next 14 days, because iOS allows 64 pending notifications.
  Today it plans only RSVP'd events with a time, so widening `mapEvents` adds
  reminders only for RSVP'd events further out. That is harmless.
- `tba` events with no time get the evening-before reminder in spec 2. Nothing
  here assumes a time exists.

## 7. Rollout

1. **Phase 1:**
   - The migration PR goes to `test`.
   - The migration is applied by hand.
   - The ESN rows are reviewed, then inserted.
   - Other societies follow as their lists arrive.
2. **Phase 2:** one PR to `test`. It reaches students in the next release: iOS
   through `/release`, the extension through the manual `publish.yml` run.
3. **Until phase 2 ships:** imported events appear 14 days ahead with no place
   and no Instagram button. That is still more than students have today.
