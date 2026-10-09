# Calendar: choose Den or Týden once, change it in Nastavení

Phone/iPad tree only. Agreed with Dominik on 2026-10-09, after Tonda's
observation that students pick a calendar view once and never touch the switch
again.

## Problem

Since #493 (5.4.0) the phone calendar has a Den/Týden switch floating above the
tab bar (`CalendarViewSwitch.tsx`). It costs a permanent band at the bottom of
every calendar state (`WeekGrid` reserves `pb-[8.5rem]`, `DayBody` and the
error state `pb-[9rem]`), for a control a student uses once. And nothing ever
asks the student which view they want: a new install opens on Den, and the week
view is found only by stumbling on two unlabeled icons.

## Research (summarised)

- No checked calendar app (Google, Apple, Outlook, Fantastical, Notion
  Calendar, Untis) asks for the view on first launch, and all of them keep the
  view control on the calendar screen. Apple's HIG puts view options "in the
  screens they affect"; when Teams mobile lost its view switcher (July 2025),
  users reported being stuck in Agenda view.
- Few users ever change a default (Spool 2011: under 5% in Word). That supports
  Tonda: the first choice is effectively permanent, so it is worth asking for
  well, once.
- The objection that matters here is the trap below ("stranded in Den"), not
  the general guidance. Dominik chose to move the setting to Profile and solve
  the trap directly.

Full notes from the research agents are in this session's transcript, not
repeated here.

## Decision

### 1. The switch leaves the calendar

`CalendarViewSwitch` is removed from `CalendarScreen`'s shell. The bottom
padding that reserved its band shrinks back to what the tab bar needs (measure,
do not guess — about 46px comes back). While the first-open panel (section 2) is
showing, it reserves its own height instead.

### 2. First open: try both, then save

When the calendar opens and the student has **never saved a view** (no
`meta.calendar_view` key), a panel sits where the switch used to float, above
the tab bar:

- Title "Jak chceš vidět rozvrh?", line "Zkus obojí na svém rozvrhu."
- A Den | Týden segmented control. Tapping it swaps the real calendar above it
  live — the student's own timetable, not a preview.
- A primary button that names what it saves: "Uložit: Den" / "Uložit: Týden".

Rules:

- **Nothing is persisted until Uložit.** Trying a view only changes what is
  shown.
- **No skip button.** Leaving the calendar without saving stores nothing; the
  calendar shows Den in the meantime and the panel returns on the next calendar
  open, until the student saves.
- **Who sees it: anyone without a saved view** — new installs and 5.4 students
  who never tapped the switch. A student who tapped it already has the key and
  is not asked — in practice nobody, since 5.4 has not shipped (see the end).
- **Sign-out wipes the choice** (`IndexedDBService.clearAll()` clears `meta`),
  so a student who signs out and back in is asked again. Accepted.
- **Only after hydration.** Follow the `welcomeSeen` / `pullHintSeen` pattern:
  the saved view hydrates to `null` (never chose) or a value; *not yet hydrated*
  shows no panel. Outside Capacitor (dev webapp at phone width, the extension at
  a phone viewport) nothing hydrates today, so the panel never shows there and
  the calendar opens on Den — same as now.
- Demo mode counts as saved, as it does for the pull hint, so reviewers and the
  demo see a clean calendar.

While the panel is open it covers the lower rows of the week grid; the grid
still scrolls underneath. Accepted — the student is comparing, not reading the
afternoon.

On Uložit the panel disappears and a toast (shared sonner wrapper) says
**"Uloženo. Změníš to v Profilu → Nastavení."** It never claims the view can be
switched on the calendar, because it cannot.

### 3. Tapping a day in Týden is a peek

Today a day-chip tap in the week grid runs `setView('day')`, which persists. With
the switch gone that would strand a Týden student in Den. Instead:

- The tap shows that day in Den **without changing the saved view**.
- Re-tapping the Kalendář tab (already "go to today", `BottomNav.tsx:64-66`)
  also returns to the saved view.
- `installCalendarResumeReset` (Capacitor `resume`) returns to the saved view as
  well as to today.
- No "Zpět na týden" control — Dominik chose the peek without one.

Store shape follows from this: a persisted **saved** view (`'day' | 'week' |
null`) and an in-memory **shown** view that the panel, the peek and the resets
drive. The current single `mobileCalendarView` splits in two.

### 4. Profile: one Nastavení row

The "Vzhled" group and the current "Nastavení" group (which holds actions, not
settings) are replaced by:

- **Nastavení** — one row; its secondary line shows the current values, e.g.
  "Týden · Čeština · Tmavý". It opens a new sheet (`{ kind: 'settings' }`) with:
  - Kalendář — Den | Týden segmented, writes the saved view directly
  - Jazyk — Čeština | English (moved from `AppearanceRows`)
  - Tmavý režim — toggle (moved from `AppearanceRows`)
- **Ve škole** — Eduroam, Dokumenty (unchanged rows, new group name)
- Admin rows (Správa, Zobrazit jako student) unchanged, admins only
- Nahlásit chybu / Nápad, Odhlásit se, the EY block — unchanged

"Skryté položky" (`HiddenItemsSection`) comes off the phone Profile: hiding
exists only on desktop calendar cards and storage is per device, so on a phone
it always renders null.

### 5. The extension does not change

The desktop calendar is always the week (`weekViewHasBothTrees.test.ts`) and its
Profile popover keeps Jazyk and Tmavý režim inline. Pin this with its reason in
`src/test/guards/` (pattern: `desktopHasNoShowOnMap.test.ts`), naming the new
phone-only files, so the tree-parity hook accepts it.

## Copy

| Where | cs | en |
| --- | --- | --- |
| Panel title | Jak chceš vidět rozvrh? | How do you want to see your timetable? |
| Panel line | Zkus obojí na svém rozvrhu. | Try both on your own timetable. |
| Segments | Den / Týden | Day / Week (existing keys) |
| Button | Uložit: Den / Uložit: Týden | Save: Day / Save: Week |
| Toast | Uloženo. Změníš to v Profilu → Nastavení. | Saved. Change it in Profile → Settings. |
| Profile row | Nastavení | Settings |
| Sheet row | Kalendář | Calendar |
| Group | Ve škole | At school |

## Testing

- Slice: saved view hydrates `null` when the key is absent; trying a view does
  not write; Uložit writes; a peek does not write; resume and tab re-tap restore
  the saved view.
- `CalendarScreen`: panel shows when saved is `null` and hydrated, not when
  unhydrated or demo; Uložit hides it and fires the toast; no switch rendered in
  any state.
- Profile: Nastavení row shows current values and opens the sheet; the sheet's
  Kalendář writes the saved view; no Vzhled group, no Skryté položky.
- Guard test for the extension decision (section 5).
- `verify-ui` at 320/390/430 and tablet width, both themes: panel geometry over
  Den and Týden, the reclaimed bottom band, the Profile at 375×667 with and
  without admin rows. Then the cabled iPad. Before/after PNGs to Dominik.

## Open questions

1. **What's new copy** for the release — agreed with Dominik per release.

Settled: students who tapped the 5.4 switch would get no panel and no toast, but
5.4 has not reached any student (Dominik, 2026-10-09), so this ships before
anyone has a saved view to migrate. If 5.4 goes out first, revisit.
