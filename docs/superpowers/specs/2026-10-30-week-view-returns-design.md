# Týden comes back to the phone and iPad

Phone/iPad tree. Agreed with Dominik on 2026-10-30 in one session: mockups on a
design canvas, then a question round. Supersedes the removal in #540 and the
choose-once design of #528 (`2026-10-09-calendar-view-choice-design.md`).

## Why

#540 removed the week grid because it "overcomplicates things", and the one
concrete gap was the room: a ~45px block gave no way to the room, while Den has
a pin on every row and the Now/Next card's Trasa. Dominik is a student who
lives in the week view, and he expects others to as well.

The first idea for the room — tap a block, choose "subject or room" — is
rejected: people learn a room in the first week and after that open the
subject almost every time. **A tap on a lesson opens its subject, always.**

Tonda's argument against a switch ("people pick a view once and never touch it
again") is taken seriously and answered with data instead of a hidden setting:
the view is remembered, and a counter measures how many use Týden.

## Decisions (Dominik's)

1. **The switch is #493's**: a list | grid icon pill floating just above the tab
   bar, on the calendar screen. No first-open chooser, no Nastavení row.
2. **The last view is remembered** per device. Every way of switching saves.
3. **Pinch in on Den → Týden. Spread on a day in Týden → that day in Den.** A
   shortcut on top of the pill, never the only way. A one-finger pull down stays
   pull to refresh everywhere.
4. **Tapping a day in Týden's header row switches to Den on that day and
   remembers Den** (not a peek: tapping the day is the choice). Spreading on a
   day does the same.
5. **Room code on every block**: the room with a pin glyph, on its own line.
   On a phone the pin is dropped for a code longer than four characters
   ("Q01.48"): the code is what the student needs, and both did not fit a
   ~45px column (measured with verify:ui).
6. **The subject sheet shows "this lesson" — room, day, time, Trasa → — only
   when it was opened from a Týden block.** From Den it would repeat the row
   the student just tapped; from Předměty there is no lesson.
7. **No route, no Trasa**: an online lesson, a room the map does not have or
   another campus shows room, day and time without the button — the rule the
   Now/Next card already follows.
8. **Týden on the phone has a "Teď" strip** above the grid (mockup A): the
   running lesson, its room, Trasa →, a progress bar and "Následuje:". It
   follows Den's card rule — **only while a lesson is running** — and the grid
   simply grows when it is gone. Showing it in the break before the next lesson
   is a separate change for both views, not this one.
9. **Pull to refresh works in Týden**, started anywhere on the screen, as in
   Den.
10. **New phone install: Den. New iPad install: Týden.**
11. **After the update the 5.4.0 choice in `meta.calendar_view` is ignored**:
    existing phones open on Den, and iPads follow decision 10 and open on
    Týden (confirmed by Dominik, 2026-10-30).
12. **The pill from Týden to Den** lands on today when the shown week is this
    week, else on the first day of the shown week that has lessons. **Den to
    Týden** shows the week of the day Den was on.
13. Society and own events behave in Týden as in Den: their text opens no
    subject. Den's row has a separate map pin; a Týden block has no room for
    one, so tapping the block itself does what Den's pin does (the map, when
    it knows the place).
14. The chef hat (#530) stays: in Týden the header's chef hat opens the menu
    with a tab per day.
15. **A counter**, `calendar_week_view`, through the existing feature counters
    (install id + one whitelisted label, once per session, one row per install
    per day). Additive whitelist migration.
16. The PR stays parked as a PR until tested on the cabled iPad and an Android
    phone (the migration applies to prod the moment it merges to `test`).

Kept from the 5.4.0 week: today's column tinted, holidays tinted red, the now
line, a swipe moves a week, clashes cascade on a phone and split on an iPad,
the grid never scrolls and fits the week's hours.

## Calls made by Claude (check these)

- **A new key, `meta.calendar_view_v2`**, so decision 11 holds without reading
  or deleting the old one. With no new key the default is decision 10 — which
  means an iPad that used 5.4.0 or 5.5.0 opens on **Týden** after the update,
  while a phone opens on Den. Read decision 11 as being about the old choice,
  not as overriding the iPad default. **Confirmed by Dominik on 2026-10-30:
  existing iPads open on Týden, as built.**
- **"iPad" = `useWideViewport()`** (the one tablet branch in JS).
- **The phone strip is a compact component**, not `NowNextCard`: the card is
  ~110px and the grid needs the height. At `md:` and up the full
  `NowNextCard` sits above the grid, as on the canvas's iPad frame.
- **Room code** = `localizedRoom` with the campus in brackets dropped (the same
  trim `routeSuggestionFor` makes). The block's room line is bold content ink
  with a pin glyph; under a cascaded clash it is hidden as before.
- **The sheet knows its origin from the sheet descriptor**: `subjectDrawer`
  gains an optional `lesson`, set only by the week grid.
- **Retapping the Kalendář tab** goes to today in the current view; there is no
  "restore the saved view" any more, because shown and saved are the same.
- **Pinch thresholds**: scale below 0.8 / above 1.25, two touches only; a
  two-finger gesture cancels the swipe and the pull. iOS page zoom is blocked
  on the calendar (`gesturestart` preventDefault) even though the viewport
  already says `user-scalable=no`.
- **The Instagram week recipe stays retired.**
- **Extension: no change.** Its week blocks already show the room with a pin,
  and its subject drawer, opened from a block, already names that lesson's room
  as a map button (`CourseMeta`). The phone's "this lesson" row brings the
  phone level with it; `weekViewHasBothTrees.test.ts` pins both halves.

## Out of scope

- The Now/Next card or strip in the break before a lesson.
- A first-launch question or a settings row for the view.
- Any change to Den.
