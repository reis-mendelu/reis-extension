# Calendar: always know which day is today

Phone/iPad tree. Agreed with Dominik on 2026-10-03.

## Problem

On Saturday 3 October 2026 the phone calendar gave no answer to "which day is
today". Two causes:

1. Nothing on the day strip marks today. The tinted pill marks the *selected*
   day, which is today only until the student moves.
2. On a weekend without lessons, today has no chip at all. `weekDays()` shows
   Mon–Fri unless the student is ever taught at the weekend, so a calendar that
   opens on Saturday shows a strip with nothing selected.

A third gap shows up once the first two are fixed: reIS keeps the old selected
day for as long as the process lives, while Google Calendar returns to today
on every reopen.

## Research (summarised)

- Google Calendar, checked on the Pixel: today is a filled circle on the date
  number, with the weekday label in the same colour, and it is independent of
  the view. The now-line is only in today's column. Tapping a day header opens
  Day view. Reopening the app goes back to today and keeps the last view.
- Apple Calendar: today is a red filled circle on the date. There is no
  portrait week grid; the week view appears only in landscape.
- Outlook and Fantastical make the week view secondary. Student apps (MyStudyLife,
  Moje MENDELU) lead with today and "up next".

## Decision

**Keep both views** (day agenda and week grid). Dominik had considered going
week-only; after the research he chose to keep both and fix today instead.
Recent files and the menza card stay under the agenda.

### 1. Today mark

On `DayChips`, in both views:

- Today's date number sits in a solid circle, `bg-primary text-primary-content`
  (6.42:1 in both themes; white on lime would be 2.29:1). Today's weekday label
  turns `--tone-primary` and bold.
- The mark is independent of selection. The selected day keeps its tonal pill,
  and on today the two combine.
- Every chip's number sits in the same fixed-size box, so the row does not
  shift when the mark moves.
- Today's chip carries `aria-current="date"`.

### 2. Today is always in its week

`weekDays(selectedIso, lessonDates, todayIso)` also includes `todayIso` when it
falls in the shown week. Other weeks keep the per-student rule. `stepDay`
takes the same argument, so swiping the agenda from Friday lands on today's
Saturday. `WeekGrid` gets the column from the same function.

### 3. Back to today on reopen

The Capacitor `resume` handler (`capacitor/startApp.ts`) calls
`setMobileSelectedDay(null)`, which is what a cold launch shows: today, or the
first teaching day before term starts. The day/week choice is kept. Returning
from anything that backgrounds the app, such as an external PDF viewer or the
share sheet, counts as a reopen, as it does in Google.

It is Capacitor-only for the reason map events are: the extension's iframe is
rebuilt on every IS page load, so it already opens fresh.

The return glyph beside the header date stays for use within a session.

## Extension

The desktop calendar already marks today (`bg-current-day-header` and
`text-current-day` in `WeeklyCalendarHeader`). The weekend rule and the reset
on resume are phone-only by construction. A guard in `src/test/guards/` records
this.

## Testing

- `weekDays` / `stepDay` unit tests with today on a weekend.
- `DayChips`: the today mark when today is selected and when it is not, and
  `aria-current`.
- Resume handler resets the selected day (`capacitor/__tests__/startApp.test.ts`).
- verify-ui at 320/390/430 and iPad width, light and dark. Release build on the
  Pixel, with before/after screenshots.
