# Admin console: a separate page behind "Spravovat spolky"

**Date:** 2026-08-11
**Status:** approved, ready for implementation

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

- **Header** (`h-14`, bottom border): title "Správa spolků"; the society being
  acted as — a static chip (logo + name) for an association, a `SocietyPicker`
  dropdown over `ALL_SOCIETIES` for a reIS admin; right side *Odhlásit* and
  *Zpět do reIS*.
- **Body**: fixed `w-96` left column with the event list (Live / Scheduled /
  Past + *Vytvořit akci*), replaced in place by `EventComposer` while composing.
  Right pane is `MapCanvas` + `EventLayer` filling the remaining width, with the
  existing "click to place" banner when `placingEvent`.

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

## Risks

- **Map reuse across two roots.** `MapCanvas` holds a Leaflet instance keyed to
  its container. Mounting it in the console after the student map has mounted
  must not reuse a stale instance — check `mapInstance.ts` teardown when the
  console opens and closes.
- **Mobile composer.** `EventComposer` was designed for a 288px desktop panel;
  its date/time fields and room search need a narrow-width pass, which is the
  bulk of the mobile work.
