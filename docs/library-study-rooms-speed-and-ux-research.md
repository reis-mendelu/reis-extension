# Study rooms: faster load and a simpler booking flow

Research only, 2026-11-27. Nothing in `src/` was changed. Phone and iPad tree only
(`desktopHasNoLibraryBooking.test.ts`); the extension never books.

Sources: the code on `origin/test` (bc4fa084, release 5.8.1), a live read-only timing run
against the library's Microsoft Bookings, prod usage counters (`feature_usage`,
`daily_active_usage`, read-only), and a screenshot of today's card (390 px, fixture data).
The persona walk-throughs are read off the code and that screenshot. They are **not** a user test.

## 1. Speed

### What the app does today

- One `POST …/GetStaffAvailability` for all six rooms and seven days (56 KB), started by
  `useLibraryStore.load()`. It runs only when the card opens (`openLibrary`, `openBooking`, or a map
  selection of a library room). Nothing starts it earlier.
- A read waits up to 45 s (`READ_TIMEOUT_MS`), a write up to 120 s.
- Data is kept in memory for 2 minutes (`STALE_MS`) and never on disk (deliberate, see `libraryStore.ts`).
- Until it answers the card shows a spinner and 12 skeleton cells.

### What I measured (Friday 27 Nov 2026, 12:03–12:15, laptop, plain `curl`, no login)

| Request | Time |
| --- | --- |
| 6 rooms × 7 days, first call | 1.57 s |
| same, 8 more calls over 3 minutes | 0.34–0.67 s |
| 6 rooms × 7 days, a date window nobody asked recently (+8, +15, +30 days) | 0.74–0.91 s |
| 6 rooms × 1 day (17 KB) | 0.94 s cold |
| 1 room × 1 day | 0.24 s |

**I could not reproduce the 10–15 s today.** On 2026-10-30 it was 8–14 s from a laptop and a
phone alike, and the code comment says 10–20 s. So the service is slow *at times*, or slow on the
device path, and today it was neither. A design built around "it takes 15 s" would be built on one bad
day. Before choosing anything expensive, measure on the phone:

1. Cheap: log each request's duration into the local diagnostic ring (`logError`-style, cleaned,
   never sent unless the student attaches it). Dominik reads it next time the card is slow.
2. Free: run the timing script from a laptop at 08:00, 10:00, 14:00 on three weekdays to see if
   the slowness follows the time of day (students and the library both peak at 8–10).

### Who opens the card (prod, 2026-11-20 → 11-27, the counter shipped with 5.8.0)

- 73 installs opened it at least once: about **3.4 %** of the ~2,100 phone installs on 5.8.0+.
- Only **7** opened it on two or more days, **2** on four or more. It is a rare, mostly one-off visit so far.
- Per weekday: 12–23 installs, out of 1,277–1,895 active (about 1 %).
- Map visitors (≥3 s on the map) were 74–118 per weekday, so roughly **one in six to one in five
  map visitors opens the card**. That is the strongest cheap signal we have.
- Caveat: one row per install per day, and the counters deliberately cannot say at what hour or whether the
  same student came back for a different reason. Early weeks of a new feature also say little about steady state.

### Prefetch options, ranked

| # | Trigger | Bookings calls/day (order of magnitude) | Hit rate | Verdict |
| --- | --- | --- | --- | --- |
| 1 | The student opens the **map tab** | ~100 | ~1 in 5 | **Do.** No history, no new state. The few seconds on the map hide most of the wait. |
| 2 | Ask for **the shown day first**, the rest of the week after | none extra | n/a | **Do.** The first answer is about a third of the bytes (17 vs 56 KB). The gain on a laptop is ~0.6 s cold; on a phone it is unknown, so measure first. |
| 3 | A device-only note "opened the card in the last 14 days" (IndexedDB, never sent), prefetch at app open on weekdays 7–19 | ≤10 today | high | **Cheap follow-up**, but today's cohort is ~10 devices, so it does little until the feature grows. |
| 4 | The calendar shows a gap ≥1 h today, or today has a library booking | a few hundred | medium | **Maybe later.** It is also the best *entry point* (section 2), so build it once for both purposes. |
| 5 | Every app open | ~1,500 | ~1 % | **No.** 99 of 100 calls are wasted, on a service that belongs to MENDELU's library. |

Showing the last answer while a fresh one loads (stale-while-revalidate) already half-works in memory:
`blocks` is not cleared on a reload. Do not keep it on disk: a free hour is wrong within minutes, and
`fetchRoomBlocks` re-checks before every write anyway. A line "stav z 14:02" under the grid would make
the staleness honest.

## 2. UX audit of today's card

Screenshot: `.verify/lib-now-390.png` (not committed). A day chip row, a grid of twelve hours, nothing else.

| # | Finding | Why it hurts |
| --- | --- | --- |
| 1 | **No instruction.** "Vyber hodiny" is only an `aria-label`. | Nobody learns that taps on neighbouring hours build one booking of up to 4 h (`toggleHour`). A student who needs 3 h books 1 h, or four times. This is the "you can book several hours" problem you named. |
| 2 | The grid shows **start hours** (14:00) with no end. | "14:00" reads as a point in time, not 14–15. The last start is 18:00 and nothing says the library closes at 19:00. |
| 3 | A **middle tap does nothing**, a non-adjacent tap silently starts over (`toggleHour`). | The student cannot tell why 16:00 "didn't work" after picking 14:00. |
| 4 | **Past hours take half the grid** at lunchtime (07–13 dead at 12:15). | The answer (what is free now) is pushed to the bottom half. |
| 5 | The grid is the union across rooms ("free while ANY room is"). | Fine as a model, but nothing says "6 rooms" or "2 left", so scarcity is invisible until after the pick. |
| 6 | The room list appears **only after** a pick, with no hint it is coming. | Day, hours, room, confirm sheet: four steps, and the second gives no sign of the third. |
| 7 | **Rooms sorted smallest first.** A group of four sees the 1-seat rooms first. | No "alone / with others" question; the list does the filtering badly. |
| 8 | **Confirm** opens with the data-sharing sentence, then a four-row summary. | The privacy line is required, but as the first and loudest text it hides the one thing the student checks: *what, when, which room*. |
| 9 | A booking can take **up to 120 s**, the sheet cannot be swiped away meanwhile. | A student standing at the library door stares at "Rezervuji…". There is no "carry on, I'll tell you". |
| 10 | **Discoverability.** The entry is a "Studovny" pin on the campus map and search. | The need arises in the calendar (a gap, an exam week), not on the map. 3.4 % tried it in the first week. |
| 11 | The 4 h/day cap appears **after** it is reached. | The student learns the rule from the refusal. |
| 12 | Past/unknown cells fail the 4.5:1 contrast check (3.58:1), flagged by `verify:ui`. | Intended for disabled cells, but "unknown" (could not load) looks the same as "past". |

## 3. Personas, walked through today's flow

| Persona | Goal | What happens today (from code and screenshot) |
| --- | --- | --- |
| **Tereza**, 1st year PEF, 90 min gap between lectures | A quiet seat now, one hand, in a corridor | Does not know the library has bookable rooms (finding 10). If she finds the pin: day is right, grid half grey, taps 14:00, sees a list, taps a room, reads the privacy sentence, confirms. Works, but she took 5 steps for 1 h and got only 1 h because nothing said "2 h". |
| **Matěj**, 3rd year AF, exam tomorrow | 4 h in a row, same room | Taps 14:00 and gets 1 h. Learns about ranges by accident, or books four times, hits the cap rule after the fact (11). |
| **Lucie + 3 friends**, project meeting next Thursday 10–12 | One team room for 4 | Switches day chip to Thursday, picks 10:00, 11:00 (finding 1 again), then scrolls past two 1-seat rooms to the 4-seat ones (7). Only Lucie's name and student number go to the library, which she must understand from the confirm text. |
| **Elena**, Erasmus, English UI | Find the room and get there | "Budova A, −1. patro" is the only location text. The card has no "how do I get there" (the map button is on the booking drawer only, after booking). Copy is translated, but "výuka" tag and the library's own e-mails are Czech. |
| **A student on weak signal at the door** | Book now, it is slow | Taps Rezervovat, sheet locks, up to 2 minutes of "Rezervuji…". Backgrounding the app may kill the request; the app tells them to check e-mail (`unknown`). |

A cheap check before building: put today's first screen in front of 5 students for 5 seconds and
ask "what would you tap to book 3 hours?". I expect most to say "14:00" and not know about ranges.

## 4. Proposed flow (for your decision, not built)

The student's question is "I need N hours around T, where?". Make that the screen:

1. **One-line answer on top**, live: "Dnes volné: 6 studoven, nejdřív od 14:00" (skeleton until it loads).
2. **Day chips** (as now).
3. **"Na jak dlouho?"** chips `1 h · 2 h · 3 h · 4 h` (4 is the cap; chips above what is left today are disabled, with the reason).
   Default is the last choice on this device (device-only note, nothing sent).
4. **"Od kdy?"** a strip of **only the start times that fit** that duration in at least one room.
   Past hours are not drawn. The selected one reads "14:00–16:00".
5. **"Kolik vás je?"** `Sám · Ve více lidech` filters Individuální vs Týmová, instead of sorting by size.
6. **Rooms** that fit, each row ending in a primary button **"Rezervovat 14–16"**. One tap to the confirm.
7. **Confirm** leads with what/when/where; the privacy sentence stays, but as a short line under the buttons' summary, not above it.
8. **Slow booking** becomes a pending row on the card ("Rezervuji Týmová 1, 14–16… můžeš zavřít, dám vědět") while the request continues, with the existing "unknown, check e-mail" ending.
9. **Entry from the calendar**: a gap of ≥1 h shows "Volno do 15:30: studovna?", opening the card prefilled with day, start and duration. Same signal can prefetch (option 4 above).

Smaller fix if the full redesign waits: keep the grid, add one line "Klepni na první a poslední hodinu, až 4 h", show the pick as "14:00–16:00 (2 h)" and hide past hours. About a day of work, and it covers findings 1–4.

What stays as it is: one place, one name per room, free = green / full = grey, the booking drawer, cancel in-app,
IC left/right, 4 h cap, own bookings overlaid as taken.

### Rules this touches

- **Both trees / tablet:** phone and iPad only by design; the iPad confirm is inline in the rail, verify at tablet width.
- **Count what you ship:** to know whether any of this works we need `open → booked`. Today only `screen_library` exists.
  A `library_booking_made` label needs the migration, `privacy/disclosures.ts` and `featureSignalLabels.ts`
  (see `docs/feature-counters.md`). Without it we can never tell whether the redesign helped.
- **Privacy:** "remember last duration / group size" is a device note; nothing new leaves the device.
- **Store forms:** none unless a flow change alters what is sent to Bookings (it does not).

## 5. Open questions

1. Go for the full duration-first flow (section 4), or the one-line fix first and the redesign after we have measured?
2. Is the calendar-gap entry point in scope for this round, or a separate one?
3. Do we add the `library_booking_made` counter now, so the next release already measures the funnel?
