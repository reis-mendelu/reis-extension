# Relocate global search → Study Plan page

**Date:** 2026-06-29
**Status:** Approved (design)
**Scope:** This spec covers **only** moving the search out of the always-on header into the Study Plan page. Resolving no-id subjects to a real `predmetId` is a **separate follow-up spec** (see "Out of scope").

## Problem

The people + subjects search currently lives in the global `AppHeader`, visible on every view. Two things are changing:

1. **Tonda is removing the searchbar from the header** — we no longer want a persistent global search; people search infrequently.
2. We want the search to live **on the Study Plan page**, where browsing subjects (and wanting to look one up) actually happens. The Study Plan header today shows only a back button + "Study Plan" title (the "Search a room or place…" box in the reference screenshot was a mockup placeholder, not a real element).

## Decisions (from brainstorming)

- **Task split:** I add search to the Study Plan page; **Tonda owns removing it from `AppHeader`**. I do **not** touch `AppHeader.tsx`, to avoid colliding with his in-flight work.
- **Entry points:** search is **study-plan-only, no global jump**. ⌘K and the host-page `REIS_OPEN_SEARCH` trigger only do anything while the Study Plan is mounted (their listeners live inside `SearchBar`). "Click to search" actions on other panels are dropped.
- **Placement:** desktop — inline in the Study Plan header, right of the title; mobile (`isNarrow`) — a full-width search row directly under the title.
- **Unresolved no-id rows on the Study Plan:** fall back to the on-page search (today's prefill behavior).

## Architecture

Reuse the existing `SearchBar` / `useSearch` unchanged — all the hard logic (faculty scoping, widen toggle, EN "v AJ" ranking, recent searches, people + subjects, ⌘K, `REIS_OPEN_SEARCH`) already lives there and rides along for free. The only structural change is **where it is mounted** and **which prefill ref it talks to**.

### Components & responsibilities

| Unit | Change | Responsibility |
|------|--------|----------------|
| `StudyPlanPage.tsx` | **edit** | Mount `<SearchBar>` in its header; own a local `prefillRef`; build its own `onSearchSubject` that targets that ref. |
| `AppMain.tsx` | **edit** | Stop routing `onSearchSubject` for Subjects/Erasmus to the global `searchPrefillRef` (pass nothing → those rows go non-interactive). Stop passing `onSearchSubject` to `StudyPlanPage` (it self-wires). |
| `SubjectRow.tsx` | **edit** | Make `onSearchSubject` **optional**; when absent and the row has no id, render it non-interactive (display-only, no "Search to open" affordance). |
| `AppHeader.tsx` | **untouched** | Tonda removes the header `SearchBar` + `MobileSearchOverlay`. |
| `SearchBar/*`, `useSearch.ts` | **untouched** | Reused verbatim. |

### Data flow

**Before:** `SubjectRow.onSearchSubject(name)` → `AppMain` `searchPrefillRef.current(name)` → header `SearchBar` registered into that ref → opens + fills the header search.

**After (Study Plan):** `StudyPlanPage` creates `const localPrefillRef = useRef<((q: string) => void) | null>(null)`, passes it to its `<SearchBar prefillRef={localPrefillRef} onOpenSubject={onOpenSubject} />`, and constructs `onSearchSubject = (name) => localPrefillRef.current?.(name)` for the `SubjectRow`s it renders. The page's own no-id "Click to search" therefore fills the on-page search.

**After (Subjects / Erasmus):** `AppMain` passes **no** `onSearchSubject`. Their no-id rows are non-interactive. (In practice the Subjects panel renders enrolled rows that have ids → direct-open, so this mainly affects Erasmus.)

The global `searchPrefillRef` plumbed from `useAppLogic` → `AppMain` → `AppHeader` becomes orphaned once Tonda removes the header search. Leaving it in place is harmless; cleaning it up is Tonda's removal change, not this one.

### Layout detail

In `StudyPlanPage`'s `header`:
- Desktop: keep `flex items-center gap-2` row → `[back] [title] [spacer] [SearchBar]`. `SearchBar` constrained (e.g. `max-w-xs`/`max-w-sm`) so it doesn't dominate the bar.
- Mobile (`isNarrow`): render the title row, then a second full-width row containing the `SearchBar` (so it isn't cramped next to the title). Use the existing narrow/`isMobile` signal already used elsewhere in the app.
- Placeholder: the default subjects/people placeholder — **not** a room placeholder.

`SearchBar`'s result dropdown is a fixed-position portal that tracks the input, so it renders correctly from this location with no extra work.

## Error handling

No new network or async paths — `SearchBar`/`useSearch` own their own loading/error states (telemetry via `logError` as today). The only new failure mode is a no-id row with no search target on other panels; "non-interactive" handles that by simply not wiring a click.

## Testing

Per CLAUDE.md (test-first):

- **`StudyPlanPage` test** (new): renders the page with a plan fixture and asserts (a) the search input is present in the header, and (b) clicking a no-id `SubjectRow`'s "Click to search" invokes the local prefill (search receives the subject name). Use the existing store/test harness pattern.
- **`SubjectRow` test** (extend or add): with `onSearchSubject` omitted and a no-id subject, the row renders **non-interactive** (no search button / no `onSearchSubject` call on click).
- Existing `useSearch` and search-engine tests are unaffected (engine unchanged).

## Out of scope (separate follow-up spec)

Resolving no-id subjects to a real IS `predmetId` so they open the `SubjectDrawer` directly instead of falling back to search. Verified feasibility (65-subject scraper sample): CDN `subjects/{code}.json` carries `predmetId`, which resolves to the correct subject ~94% of the time, though ~60% point to an older-semester instance (acceptable, since Files/Classmates are restricted for non-enrolled subjects anyway). That work needs a **validity guard** (reject absurd ids like `3`/`4`/`7`) and **search fallback** for the ~17% with no id, plus a type/IDB-schema addition for `predmetId`. It touches sync/data-enrichment and gets its own spec + plan.

## Out of scope (other)

- `AppHeader` searchbar removal (Tonda).
- Any change to `SearchBar`/`useSearch` internals.
- Cleanup of the now-orphaned global `searchPrefillRef` plumbing (folds into Tonda's removal).
