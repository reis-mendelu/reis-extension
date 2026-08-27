# Exam duration from the term detail page

**Date:** 2026-07-27
**Status:** implemented on `fix/exam-duration-from-detail-page`

## Problem

The weekly calendar assumed every exam lasts 90 minutes:

```ts
// useCalendarData.ts
const endObj = new Date(dateObj.getTime() + 90 * 60000);
```

That is wrong in both directions. A 10-minute oral exam and a 3-hour written
exam both rendered as identical 1.5h blocks, so the calendar misrepresented how
much of the day an exam actually consumes.

IS Mendelu publishes the real length as **"Délka trvání akce"** on the term
detail page (`terminy_info.pl`). It is *not* present on the exam list page
(`terminy_seznam.pl`), so the list parser cannot supply it.

## Scope

Fix the underlying number only — no new UI. The single consumer is the
calendar block's end time.

## Design

### Source

`terminy_info.pl` was already being fetched and parsed for the teacher's
Poznámka (`src/api/terminyInfo.ts`). The duration lives in the same table, in
the same label/value cell shape verified against a real 2026-07 sample:

```html
<td class="odsazena" nowrap="nowrap" align="left"><b>Délka trvání akce:</b></td>
<td class="odsazena" align="left">10 minut</td>
```

### Components

| Unit | File | Responsibility |
|------|------|----------------|
| Pure text → minutes | `src/api/termDuration.ts` (`parseDurationText`) | Format handling, plausibility bounds, telemetry on unknown formats |
| DOM → minutes | `src/api/termDuration.ts` (`parseTermDurationPage`) | Label-anchored cell scan |
| Fetch one term | `src/api/termDuration.ts` (`fetchTermDuration`) | Detail-page guard via `isTermDetailPage` |
| Sync enrichment | `src/services/sync/examDurations.ts` | Cache reuse, concurrency cap, failure isolation |
| Wiring | `src/injector/syncService.ts` | Both the phase-2b path and `refreshExams` |
| Consumption | `src/components/WeeklyCalendar/useCalendarData.ts` | `durationMinutes ?? 90` |
| Layout floor | `src/components/WeeklyCalendar/utils.ts` | `renderedBlockMinutes` — shared by `getEventStyle` and the card |

`termDuration.ts` is a new file rather than an extension of `terminyInfo.ts`
because that file was already at 189 lines against the repo's 200-line cap.

### Data flow

Content script sync → `fetchDualLanguageExams()` → `enrichExamsWithDurations()`
→ `registeredTerm.durationMinutes` → IDB + `REIS_SYNC_UPDATE` → iframe store →
`useCalendarData` → block end time.

Only **registered** terms are enriched: they are the only ones the calendar
renders, and a student holds a handful per semester, so this costs a few
requests rather than one per available term. Concurrency is capped at 3,
matching the existing on-demand Poznámka path.

### Caching

A term's duration is static once published, so any value already present in the
cached exams is reused and never refetched. No TTL bookkeeping; a term that
failed is simply retried next sync.

### Error handling

Every failure path degrades to the historical 90-minute assumption, so missing
data reproduces today's behaviour exactly rather than inventing a new default:

- IS omits the field / `-- nezadáno --` → `null`
- Unrecognised format → `null` + `logError('Parser.parseDurationText')`
- Value outside 1..720 minutes → `null` (a mis-parse must not become a
  multi-day calendar block)
- Fetch fails or session expired → `logError`, term left without a duration

`enrichExamsWithDurations` never throws. Sync must not fail because an exam
length could not be read.

### Short-exam rendering

A 10-minute block is ~1.2% of the 14-hour grid — about 7px — which clips the
card's subject, room and teacher. The grid therefore floors the rendered
*height* at **90 minutes**' worth of grid, via `renderedBlockMinutes` in
`WeeklyCalendar/utils.ts`.

90 rather than something smaller because `CalendarEventCard` independently gates
the subject and room on `duration >= 60`. That was invisibly always-true while
every exam was assumed to last 90 minutes; real durations flipped it false for
short exams, so the first attempt at a 30-minute floor still produced a block
labelled only "exam". Both `getEventStyle` and the card now read the same
`renderedBlockMinutes` helper, so the two cannot drift apart again.

The floor is deliberately layout-only. `startTime`/`endTime` stay truthful, so
the card label and tooltip still read `12:00 - 12:10` and `organizeLessons`
overlap detection still uses real times.

**Residual risk:** overlap detection uses true times while the block is drawn at
the floored height, so a 10-minute exam followed by a lesson 30 minutes later
can overlap visually without the layout assigning them separate columns. Not
observed in the mock week; worth revisiting if it shows up with real data.

## Known gap

Only `"10 minut"` has been observed on a real page. The hour, combined and
clock-format branches are defensive and unverified. Unrecognised formats are
reported via telemetry so real-world variants surface as data rather than
silently degrading to the fallback.

## Verification

- `parseDurationText` / `parseTermDurationPage` / `fetchTermDuration` — 33 tests,
  including one against a scrubbed excerpt of a real IS page
- `enrichExamsWithDurations` — 9 tests: cache reuse, no-mutation, per-term
  failure isolation, concurrency cap
- `useCalendarData` — 10min → `09:55`, 180min → `12:45`, absent → `11:15`
- `getEventStyle` / `renderedBlockMinutes` — a 10min block draws the same height as
  a 90min one, 180min is left untouched, the block start never shifts

Confirmed in the running dev webapp with four registered mock exams, after a
hard reload: 180min → `08:00-11:00` at 21.4286% (166px); 10min → `12:00-12:10`
at 10.7143% (83px), i.e. the same box as the 90min term, rendering its subject,
room and true span; 90min → `13:30-15:00`; absent-duration → `15:30-17:00`.

## Privacy

The real captured page contains personal data and is **not** committed. The
fixture at `src/api/__tests__/fixtures/terminy-info-duration.html` is a scrubbed
excerpt: markup, class names, nbsp entities and value wording are verbatim;
subject, teacher, ids and room are placeholders.
