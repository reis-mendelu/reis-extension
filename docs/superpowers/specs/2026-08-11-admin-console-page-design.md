# Admin console: a separate page behind "Spravovat spolky"

**Date:** 2026-08-11
**Status:** decisions in the table below were made by the user; the rest follows
from them and is open to correction during implementation.

## Problem

There is no admin surface. Society authoring is welded into the student campus map:

- `SpolkySection` renders a "Spravovat spolek" button → `openSocietyAdmin()`.
- `openSocietyAdmin()` flips `mapMode` to `'society'` and focuses the campus map.
- Authoring appears as a third tab ("Moje akce") inside the map's 288px side panel,
  with the student sidebar, header and search still on screen.
- `reis_admin` accounts get nothing but a modal note: "Manage events under a
  specific society." There is no way to pick one.

The student interface and the admin interface are the same interface with a tab
swapped.

## Server-side starting point (verified against the live database)

Checked `pg_policies` on project `zvbpgkmnrqyprtkyxkwn`:

- `spolky_events` INSERT / UPDATE / DELETE each allow
  `association_id = (the caller's own account) OR get_my_role() = 'reis_admin'`.
  A reIS admin can already author for **any** society.
- `spolky_accounts` allows a reIS admin to SELECT all rows, INSERT and UPDATE;
  an association can read only its own row.

**No schema, policy or Edge Function work is required.** The only thing standing
between the two roles is which `association_id` the client sends.

## Decisions

| Question | Decision |
| --- | --- |
| How separate? | Full-screen takeover — the student shell is not rendered at all |
| What lives there? | Event authoring only; the map's "Moje akce" tab is removed |
| reIS admin extra | A society switcher. No account management, no analytics dashboard |
| Not-logged-in click | The page takes over immediately and shows login on it |
| Mobile | In scope — both shells, same page, laid out for narrow widths |
| Architecture | Sibling root surface, not an `AppView` and not a second WXT entry |

Explicitly out of scope: society profile/settings editing, `spolky_accounts`
management, and the `feedback_responses` / `daily_active_usage` dashboard (that
stays in the reis-admin Vercel app).

## Architecture

### The takeover

`src/components/AdminConsole/AdminConsole.tsx` is the root. Both shells get one
early branch:

```tsx
// App.tsx and MobileApp.tsx
if (adminConsoleOpen) return <AdminConsole />;
```

`AdminConsole` decides its own contents: no `adminSession` → login screen;
session present → console. `Sidebar`, `AppHeader`, `AppMain`, `MobileNav` and
`AppView` are never touched, and `AppView` stays a student-only union.

### `mapMode` is deleted, not extended

`mapMode: 'student' | 'society'` currently serves as both the event-pool
discriminator (`createMapSlice.focusEventById`, `EventLayer`) and the de-facto
"am I in admin mode" flag. `adminConsoleOpen` replaces it 1:1: the console's map
draws `societyMapEvents`, the student map draws `mapEvents`.

Removed with it: `setMapMode`, its `if (!adminAssociationId) return` gate, the
`'mine'` tab in `MapSidePanel`, and `mapPanelTab`'s `'mine'` case.

### Effective society

`EventComposer` and `loadSocietyPosts` read `adminAssociationId`, which is the
*account's* society and is `null` for a reIS admin. Add a second field:

- `adminActiveAssociationId: string | null` — the society currently being edited.
- `adminLogin` and `loadAdminSession` set it to `associationId` for an
  `association`; a `reis_admin` leaves it `null` until the picker sets it.
- `setActiveAssociation(id)` sets it and calls `loadSocietyPosts()`.
- All authoring reads/writes switch to it.

`adminAssociationId` keeps its meaning (who you are) and remains what
`SpolkySection` and the role checks look at.

### Entry and exit

- `openSocietyAdmin()` collapses to `set({ adminConsoleOpen: true })`,
  unconditionally — logged in or not.
- Deleted: `adminOverlayOpen`, `openAdminOverlay`, `closeAdminOverlay`,
  `enterSocietyMode`, `SocietyAdminOverlay.tsx`, and the now-dead
  `admin.reisAdminNote` string in both locales.
- `SocietyLoginForm` moves onto the console.
- "Zpět do reIS" clears `adminConsoleOpen` plus composer/draft state and
  **keeps the session** — clicking the button again returns straight to the
  console.
- `adminLogout()` also closes the console.
- Boot never auto-opens the console; a restored session lands in the student app.

### `SpolkySection` changes

1. The manage button is always rendered. Today a logged-in session *replaces* it
   with a Logout row; that inverts — the button is the only way in, and logout
   lives in the console header.
2. `admin.manageButton` is relabelled to the plural **"Spravovat spolky"** /
   "Manage societies".
3. The triple-click easter egg on the student-ID label (`useTripleClick` in
   `ProfilePopup` and `MobileProfileSheet`) is removed. A second, hidden entrance
   contradicts gating the section behind the button. `useTripleClick` is deleted
   if nothing else uses it.

## Layout

### Desktop

- **Header** (`h-14`, bottom border): *Zpět do reIS*, title "Správa spolků";
  right side the society being acted as — a static chip (logo + name) for an
  association, a `SocietyPicker` dropdown over `ALL_SOCIETIES` for a reIS admin
  — then *Odhlásit*.
- **Body**: fixed `w-96` left column with the event list (Live / Scheduled /
  Past + *Vytvořit akci*), replaced in place by `EventComposer` while composing.
  Right pane is `MapCanvas` + `EventLayer` filling the remaining width, with the
  existing "click to place" banner when `placingEvent`.

*Built*: *Vytvořit akci* stayed at the top of the list column rather than moving
into the console header — next to *Odhlásit* and *Zpět do reIS* it read as
console chrome rather than as an action on the list below it.

No `DetailPanel` on the console's map. That card is the student's read surface,
carrying RSVP and directions; in the console the list column is the detail view
and a selected pin only highlights its row.

### Mobile

No persistent map pane — there is no room. The event list is the screen;
*Vytvořit* pushes the composer full-screen; `beginPlacing` opens the map as a
full-screen sheet that places the pin and pops back. The header collapses to a
back arrow, the society name or picker, and an overflow menu for logout.

### Files

| File | Role | Est. lines |
| --- | --- | --- |
| `AdminConsole/AdminConsole.tsx` | root, login-vs-console gate, shell choice | ~60 |
| `AdminConsole/AdminConsoleHeader.tsx` | identity/switcher, logout, exit | ~70 |
| `AdminConsole/SocietyPicker.tsx` | reIS-admin society dropdown | ~50 |
| `AdminConsole/AdminEventList.tsx` | from `MyEventsPanel`, minus its identity bar | ~150 |
| `AdminConsole/AdminConsoleMap.tsx` | map pane + placing banner | ~40 |
| `AdminConsole/MobileAdminConsole.tsx` | narrow-width stack | ~90 |

`MyEventsPanel.tsx` is removed once `AdminEventList` replaces it. `EventRow`,
`EventComposer`, `MapCanvas` and `EventLayer` are reused unchanged apart from
the `adminActiveAssociationId` swap in `EventComposer`.

## Data flow

Unchanged: `loadSocietyPosts()` → `societyPosts` → `refreshSocietyMapEvents()` →
`societyMapEvents`. Only the id source moves. The picker calls
`setActiveAssociation(id)`, which reloads posts and refreshes the console map.

## Error handling

- A reIS admin with no society picked sees an empty state prompting a choice,
  and *Vytvořit akci* is disabled.
- Save/delete failures keep the existing `admin.saveError` toast.
- New `logError` contexts follow the convention: `AdminConsole.<action>`.
- A login that resolves to `role === null` keeps today's behaviour — sign out and
  return `account_unavailable`, surfaced on the login screen rather than a modal.

## Testing

Tests are written before implementation, per the repo's Iron Rules.

**`createAdminSlice.test.ts`**
- `openSocietyAdmin()` opens the console whether or not a session exists.
- `adminLogin` as `association` sets `adminActiveAssociationId` to its own id.
- `adminLogin` as `reis_admin` leaves `adminActiveAssociationId` null.
- `setActiveAssociation(id)` sets the id and reloads posts.
- `adminLogout()` closes the console and clears both association fields.
- Closing the console keeps `adminSession` intact.

**Component tests**
- `AdminConsole` renders the login form with no session, the console with one.
- The society picker renders for `reis_admin` and not for `association`.
- `SpolkySection` always renders the manage button and never a logout row.
- `MapSidePanel` renders exactly two tabs, with no `'mine'` case.
- `ProfilePopup` / `MobileProfileSheet` no longer open admin on triple-click.

**UI verification**
The `verify-ui` skill at 320 / 390 / 430 for the mobile console, plus a desktop
pass, checking overflow, collision and dark-theme contrast.

## Risks, as they turned out

- **Map reuse across two roots** — *not a problem*. `MapCanvas`'s init effect
  already calls `map.remove()` and `setMapInstance(null)` on unmount, and the
  two shells never render at once, so exactly one Leaflet instance exists at a
  time.
- **Mobile composer** — *one real bug, found by `verify:ui`*. `EventComposer`'s
  header is `bg-base-200/60`, a tint designed to read over the map panel's
  `bg-base-100/95`. The phone stack initially put the list straight onto the
  page's `base-200` backdrop, where that header measured **1.005:1 — invisible
  in the dark theme**. Fixed by giving the phone content area `bg-base-100`,
  matching the desktop aside. Nothing else about the composer needed a
  narrow-width pass.
- **Bonus AA miss.** `MiniCalendar`'s unset-state placeholder was
  `text-base-content/50` = 4.48:1, just under WCAG AA. Bumped to `/60`. It had
  never been measured because the composer had only ever existed in a
  desktop-only side panel.

## Verification

`npm run verify:ui` at 320 / 390 / 430 — console, composer and login screen,
dark and light: **no layout or contrast findings**. Desktop measured by hand:
`1014 = 384 (aside) + 630 (map)`, `964 = 56 (header) + 908`, and
`scrollHeight === innerHeight`, so nothing overflows.

`verify:ui` needed two small extensions to reach the console at all, since it
sits three clicks deep behind an icon-only trigger:

- `--click` is now repeatable, clicking each text in order with a settle between
  steps.
- Each step falls back from `getByText` to accessible name, so icon-only
  controls (the phone shell's initials avatar) are reachable.

Not verified end-to-end: clicking the map to drop an off-campus pin. Leaflet
does not respond to synthetic events, and the browser automation's coordinate
space does not match the page's, so the click could not be delivered. The
placing banner does appear on the console's map, and the code path
(`beginPlacing` → `MapCanvas` click handler → `placeDraftCoord`) is unchanged by
this work — only its host container moved.

## Testing the real publish path (added after review)

The webapp harness could not exercise a real publish. `createPost` returns
`devSocietyStore.create(...)` whenever `VITE_DEV_SOCIETY` is set
(`src/api/societyPosts.ts`), so on `npm run dev:web` a publish lands in an
in-memory object and never reaches Supabase — the fake session that makes the
console reachable is the same flag that makes its writes meaningless. Clearing
the flag restores the real Supabase path but leaves a login form.

`npm run dev:web:admin` closes that gap. It clears `VITE_DEV_SOCIETY` and signs
the harness in as a real account, so publishes hit live Supabase and its RLS
policies:

```bash
infisical run --env=dev -- npm run dev:web:admin
```

Two secrets, `REIS_ADMIN_EMAIL` and `REIS_ADMIN_PASSWORD`. Any env source works
— Infisical is just the one that keeps them out of the repo and off disk.

**The sign-in happens in the Vite dev server, not the browser**
(`dev/adminSessionPlugin.ts`). The password stays in the node process; only the
resulting session crosses to the page, which is exactly what a real login would
have deposited there. Three reasons this shape was chosen over a `VITE_`-
prefixed credential: a `VITE_` variable is inlined into client source and would
put the password in the bundle and in devtools; the plugin is registered only by
`vite.web.config.ts`, so `wxt build` cannot see it; and with no credentials
present the route answers 204 and the harness shows the normal login screen, so
the default `npm run dev:web` is unchanged.

Verified: 204 when unconfigured, 502 + `sign_in_failed` on bad credentials (a
real round-trip to Supabase), and the client degrades to the login screen with a
single warning. The success branch needs the real secret and is the one step
that has not been run.

Use a **society** account, not a reIS-admin one, unless testing the picker: a
reIS admin can write to every society and read PII (`feedback_responses`,
`daily_active_usage`), which is more authority than a local harness needs.
