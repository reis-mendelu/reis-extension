# Society Events Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students see every upcoming society event of the semester, including events whose place and time are not known yet, with the society's Instagram as the "details" link. Societies can post and edit such events.

**Architecture:**
- **Phase 1 (Tasks 1–2)** is database-only and reaches every installed app with no release:
  - `venue_kind = 'tba'` and `societies.instagram`
  - a reviewed bulk insert of ESN's semester
- **Phase 2 (Tasks 3–14)** is one client PR on shared code, so it lands on both trees:
  - the catalog shows the whole semester, while pins and Novinky keep a 14-day "soon" horizon
  - a TBA venue line and the Instagram fallback button
  - a composer that accepts a missing place and time, plus an end date
  - the admin console gets an interest count and loses its "Naplánované" bucket
  - events reload when the app resumes, and a failed fetch keeps the last list
  - a Novinky tap opens the event card

**Tech Stack:** React 19 + TypeScript, Zustand slices, Supabase (PostgREST), Vitest + Testing Library, DaisyUI/Tailwind, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-09-28-society-events-catalog-design.md`

## Global Constraints

- **Branches:** PRs go to `test` (`gh pr create --base test`), never `main`.
- **Production writes** (migration, insert, `societies.instagram` update) run only after Dominik's explicit "yes" in chat for that exact write. Use `npx supabase db query --linked`, never `db push`.
- **Migrations do not self-apply.** Apply by hand with `-f`, after a dry run in a self-unwinding `DO` block.
- **App language codes** are `'cz'`/`'en'`, and locale files are `cs.json`/`en.json`. Every new UI string goes in both.
- **Styling:** no custom CSS; use DaisyUI semantic classes. No `localStorage`/`sessionStorage`. All state goes in Zustand slices. No `useEffect` data fetching.
- **Files stay at or under 200 lines** (convention). Split before adding when a file is already over.
- **Test first:** write each failing test before its code.
- **Local checks:** run `npx vitest run <pattern>` for the touched tests and `npm run typecheck`. Leave repo-wide lint, format and the full suite to CI. Under load, use `--no-file-parallelism --maxWorkers=1`.
- **Never modify IS Mendelu parsers.** None are touched by this plan.
- **Handles:** Instagram handle regex is `^[A-Za-z0-9._]{1,30}$`. Store the handle without `@`, never a URL.
- **Imported rows:** `created_by = 'import:2026-09-28'`, `venue_kind = 'tba'`, `url = null`. Never put Instagram in `url`: a Novinky tap on a URL row skips the card.
- **Windows:** the "soon" horizon for pins and Novinky is 14 days (today to today+13). The catalog list has no upper bound.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260928120000_spolky_events_tba_and_instagram.sql` | create | allow `tba`; add `societies.instagram` |
| `supabase/migrations/20260928130000_spolky_events_tba_has_no_place.sql` | create | a `tba` row carries no room and no coordinates |
| `src/api/societyPosts.ts` | modify | `VenueKind` gains `'tba'` |
| `src/types/events.ts` | modify | `MapEvent.venueKind` gains `'tba'`; `Society.instagram?` |
| `src/components/CampusMap/eventWindow.ts` | modify | `SOON_WINDOW_DAYS`, `localTodayIso`, `isFinishedEvent`, `isSoonEvent`, `isBeyondSoon`; drop `isPublicEvent`/`isScheduledEvent`/`goLiveDate`/`PUBLIC_WINDOW_DAYS` |
| `src/api/mapEvents.ts` | modify | server bound on "not finished", no 14-day filter, `null` on error |
| `src/store/slices/createMapSlice.ts` + `src/store/types.ts` | modify | keep the list on a failed fetch; `mapEventsFetchedAt`; `refreshMapEventsIfStale`; `mapLaterExpanded` + `toggleMapLater` |
| `src/components/CampusMap/EventLayer.tsx`, `EventPin.tsx` | modify | pins only for soon events; `scheduled` marker removed |
| `src/components/CampusMap/eventHelpers.ts` | modify | `weekSections` gains `later`; `relativeDayLabel` beyond 14 days |
| `src/components/CampusMap/MapEventsSection.tsx` | modify | collapsible "Později (N)" section |
| `src/api/societies.ts`, `src/api/societiesAdmin.ts`, `src/store/slices/societies/saveSociety.ts` | modify | read and write `instagram` |
| `src/components/AdminConsole/societyFormRules.ts`, `SocietyForm.tsx` | modify | `normalizeInstagram`; Instagram field |
| `src/components/CampusMap/EventVenueLine.tsx` | create | the card's venue row (room / Maps link / name / TBA) |
| `src/components/CampusMap/eventLinks.ts` | create | `eventDetailsLink(event, society)` fallback order |
| `src/components/CampusMap/EventDetailCard.tsx`, `EventRow.tsx` | modify | TBA line; Instagram button |
| `src/components/CampusMap/composerRules.ts` | create | `isComposerReady`, `deriveVenue`, `buildPostInput` |
| `src/components/CampusMap/ComposerWhenField.tsx` | create | date + time + optional end date |
| `src/components/CampusMap/EventComposer.tsx`, `composerPost.ts` | modify | use the rules; TBA save; `end_date` in the patch |
| `src/components/AdminConsole/AdminEventList.tsx`, `EventStats.tsx`, `src/store/slices/createAdminSlice.ts` | modify | Upcoming/Past only; "Bez místa"; "Zájem v reIS: N" |
| `src/services/spolky/spolkyService.ts`, `dropScheduledEvents.ts` | modify | Novinky bounds + limit 200 + not-finished |
| `src/hooks/useOpenNotification.ts` | modify | event card first, link as fallback |
| `capacitor/startApp.ts` | modify | resume → `refreshMapEventsIfStale` |
| `src/i18n/locales/cs.json`, `en.json` | modify | new strings (listed per task) |

---

## PHASE 1 — database and import (no release)

### Task 1: Migration for `tba` and `societies.instagram`, plus the type widening

**Files:**
- Create: `supabase/migrations/20260928120000_spolky_events_tba_and_instagram.sql`, `supabase/migrations/20260928130000_spolky_events_tba_has_no_place.sql`
- Modify: `src/api/societyPosts.ts:5`, `src/types/events.ts:97`
- Test: `src/api/__tests__/mapEvents.test.ts`

**Interfaces:**
- Produces: `type VenueKind = 'campus' | 'online' | 'offcampus' | 'tba'`, and `MapEvent['venueKind']` equal to the same union.

- [ ] **Step 0: Branch from `test`.** This worktree was cut from `main` for another task, so start a clean branch and bring the spec and plan along:

```bash
git fetch origin
git switch -c claude/events-tba-migration origin/test
git cherry-pick d3515253 ea6343bf 62c83d4c   # spec + plan, from claude/student-events-data-strategy-74396b (plus any later docs commit)
```

- [ ] **Step 1: Write the failing test** (append to `src/api/__tests__/mapEvents.test.ts`)

```ts
import { toRow, type PostInput } from '../societyPosts';

describe('a place-TBA event', () => {
  it('is a valid PostInput and maps to a tba row with no place', () => {
    const input = {
      title: 'Pub Quiz', body: '', category: 'quiz', date: '2026-10-13', venueKind: 'tba',
    } satisfies PostInput;
    expect(toRow(input, 'esn', 'x')).toMatchObject({ venue_kind: 'tba', coord_lng: null, room_code: null, time: null });
  });
  it('maps back to a MapEvent with no coordinate', () => {
    const e = toMapEvent(
      {
        id: 't1', association_id: 'esn', title: 'Pub Quiz', category: 'quiz',
        date: '2026-10-13', end_date: null, time: null, venue_kind: 'tba',
        room_code: null, coord_lng: null, coord_lat: null, location: null, url: null,
      },
      BUNDLED_SOCIETIES
    );
    expect(e.venueKind).toBe('tba');
    expect(e.coord).toBeNull();
  });
});
```

- [ ] **Step 2: Run `npm run typecheck`.** Expected: FAIL. The `satisfies PostInput` line reports `Type '"tba"' is not assignable to type 'VenueKind'`.

- [ ] **Step 3: Widen the types**

`src/api/societyPosts.ts:5`:
```ts
export type VenueKind = 'campus' | 'online' | 'offcampus' | 'tba';
```
`src/types/events.ts:97`:
```ts
  /** 'tba' = the society has not said where yet: no pin, list-only. */
  venueKind: 'campus' | 'online' | 'offcampus' | 'tba';
```

- [ ] **Step 4: Write the migration**

```sql
-- Place not known yet is a first-class state: societies hand over whole-semester
-- lists (title + date) long before they know venues. A 'tba' row has no room and
-- no coordinates; it is list-only on the map until the society adds a place.
-- Spec: docs/superpowers/specs/2026-09-28-society-events-catalog-design.md
alter table public.spolky_events drop constraint if exists spolky_events_venue_kind_check;
alter table public.spolky_events add constraint spolky_events_venue_kind_check
  check (venue_kind = any (array['campus','online','offcampus','tba']));

-- The society's Instagram handle, shown as "Více na Instagramu" on events with
-- no URL of their own. A HANDLE, never a URL: the client builds
-- https://www.instagram.com/<handle>/, so nothing else can be linked from it.
alter table public.societies add column if not exists instagram text
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
comment on column public.societies.instagram is
  'Instagram handle without @. The client builds the URL; it is never stored.';

notify pgrst, 'reload schema';
```

Then the follow-up migration `20260928130000_spolky_events_tba_has_no_place.sql` (added from review on #471): a `tba` row carries no room and no coordinates.

```sql
-- A 'tba' event is list-only BECAUSE it has no place: the client pins anything
-- with a coordinate and flies to anything with a room code. A row marked 'tba'
-- that still carried either would be pinned while its card says "Místo upřesní",
-- so the database refuses the combination, the same way campus/offcampus rows
-- are held to theirs (spolky_events_venue_invariants).
-- Adding a place later is an UPDATE to campus/offcampus, which this allows.
-- `location` (free text) is deliberately not covered: a hint like "Brno" is fine.
alter table public.spolky_events drop constraint if exists spolky_events_tba_no_place_chk;
alter table public.spolky_events add constraint spolky_events_tba_no_place_chk
  check (venue_kind <> 'tba' or (room_code is null and coord_lng is null and coord_lat is null));

notify pgrst, 'reload schema';
```

- [ ] **Step 5: Dry-run against production.** The `DO` block raises at the end, so nothing is kept.

```bash
npx supabase db query --linked "do \$\$ begin
  alter table public.spolky_events drop constraint if exists spolky_events_venue_kind_check;
  alter table public.spolky_events add constraint spolky_events_venue_kind_check check (venue_kind = any (array['campus','online','offcampus','tba']));
  alter table public.societies add column if not exists instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}\$');
  insert into public.spolky_events (association_id,title,category,date,venue_kind,body) values ('esn','dry-run','quiz','2026-12-01','tba','');
  begin insert into public.spolky_events (association_id,title,category,date,venue_kind,body) values ('esn','dry-run','quiz','2026-12-01','foo',''); raise exception 'foo accepted'; exception when check_violation then null; end;
  alter table public.spolky_events drop constraint if exists spolky_events_tba_no_place_chk;
  alter table public.spolky_events add constraint spolky_events_tba_no_place_chk check (venue_kind <> 'tba' or (room_code is null and coord_lng is null and coord_lat is null));
  begin insert into public.spolky_events (association_id,title,category,date,venue_kind,body,room_code) values ('esn','dry-run','quiz','2026-12-01','tba','','Q01'); raise exception 'tba with a room accepted'; exception when check_violation then null; end;
  begin update public.societies set instagram='a/b' where id='esn'; if not found then raise exception 'esn row missing: constraint not exercised'; end if; raise exception 'a/b accepted'; exception when check_violation then null; end;
  raise exception 'DRY RUN OK';
end \$\$;"
```

Expected: `ERROR: DRY RUN OK`. Any other error means stop and report.

- [ ] **Step 6: Typecheck and tests.** `npm run typecheck && npx vitest run src/api/__tests__/mapEvents.test.ts`. Expected: PASS.

- [ ] **Step 7: Commit and open the PR**

```bash
git add supabase/migrations/20260928120000_spolky_events_tba_and_instagram.sql supabase/migrations/20260928130000_spolky_events_tba_has_no_place.sql src/api/societyPosts.ts src/types/events.ts src/api/__tests__/mapEvents.test.ts
git commit -m "feat(events): allow place-TBA events and a society Instagram handle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u personal HEAD
gh pr create --base test --title "feat(events): place-TBA events + society Instagram (migration)" --body "Phase 1 of docs/superpowers/specs/2026-09-28-society-events-catalog-design.md. Migration only, plus type widening; applied by hand after approval.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then turn on Auto-fix for the PR and bind it with the ccd_pr tools.

- [ ] **Step 8: STOP and ask Dominik to approve applying the migration to production.** On "yes":

```bash
npx supabase db query --linked -f supabase/migrations/20260928120000_spolky_events_tba_and_instagram.sql
npx supabase db query --linked -f supabase/migrations/20260928130000_spolky_events_tba_has_no_place.sql
npx supabase db query --linked "select conname, pg_get_constraintdef(oid) from pg_constraint where conname in ('spolky_events_venue_kind_check','spolky_events_tba_no_place_chk')"
```

Expected: `spolky_events_venue_kind_check` lists `'tba'`, and `spolky_events_tba_no_place_chk` exists. (Before applying the second file, check it against every deployed build's writes: released composers always write `venue_kind` together with the coordinates, so an edited `tba` event becomes `campus`/`offcampus`.)

### Task 2: Import ESN's semester and set the Instagram handles

**Files:**
- Uses: `<scratchpad>/import/esn.py`, `esn.sql` and `esn.md` (already generated; not committed)

- [ ] **Step 1: Regenerate, keeping only events from today on.** In `esn.py`, filter `rows` to `r[0] >= date.today().isoformat()` before writing. Re-run `python3 esn.py`. Expect `weekday/category mismatches: []`.

- [ ] **Step 2: Apply the title Dominik chose for "BU Karaoke"** (he still has to answer). If he says it is Brno United, replace the title with `Brno United Karaoke` in all six rows.

- [ ] **Step 3: Show Dominik the final table** (`esn.md`) and the handle update below. Ask for an explicit yes to both writes.

```sql
update public.societies set instagram = v.h from (values
  ('esn','esnmendelubrno'), ('au_frrms','au_frrms'), ('usaf','uniestudentuaf'),
  ('ldf','spldf_mendelu'), ('zf','led_zf')) as v(id,h)
where societies.id = v.id;
```

`supef` and `ey` stay null until the society confirms its handle.

- [ ] **Step 4: On yes, run both writes**

```bash
npx supabase db query --linked -f <scratchpad>/import/esn.sql
npx supabase db query --linked "update public.societies set instagram = v.h from (values ('esn','esnmendelubrno'),('au_frrms','au_frrms'),('usaf','uniestudentuaf'),('ldf','spldf_mendelu'),('zf','led_zf')) as v(id,h) where societies.id = v.id"
```

- [ ] **Step 5: Verify**

```bash
npx supabase db query --linked "select to_char(date,'DD.MM.') as d, to_char(date,'Dy') as dow, end_date, title, category from public.spolky_events where created_by='import:2026-09-28' order by date, title"
npx supabase db query --linked "select id, instagram from public.societies order by id"
```

Expected:
- Diff the first result row by row against `esn.md`. Each date, weekday (`Mon`↔`Mo`, `Tue`↔`Tu`, and so on), end date, title and category must match, and the row counts must be equal.
- The five handles are set.

- [ ] **Step 6: The Novinky limit, until phase 2 ships.** Current clients take the 50 soonest rows across all societies before keeping only followed ones. Before importing any further society, check this and stop if the count is ≥ 50:

```bash
npx supabase db query --linked "select count(*) from public.spolky_events where date between current_date and current_date + 13"
```

---

## PHASE 2 — client (one PR, next release)

Start a new branch from `origin/test` once Task 1's PR has merged:

```bash
git fetch origin && git switch -c claude/society-events-catalog origin/test
```

### Task 3: `eventWindow`, a "soon" horizon and "finished" judged by end date

**Files:**
- Modify: `src/components/CampusMap/eventWindow.ts`
- Test: `src/components/CampusMap/__tests__/eventWindow.test.ts` (rewrite the window cases)

**Interfaces:**
- Produces:
  - `SOON_WINDOW_DAYS = 14`
  - `localTodayIso(now?: Date): string` (local `YYYY-MM-DD`)
  - `isFinishedEvent(e: { date: string; endDate: string | null }, now?: Date): boolean`
  - `isSoonEvent(e: { date: string; endDate: string | null }, now?: Date): boolean`
  - `isBeyondSoon(iso: string, now?: Date): boolean`
- Keeps: `daysUntilEvent`, `isPastEvent`, `hasFinished`, and **for now** `PUBLIC_WINDOW_DAYS`, `isPublicEvent`, `isScheduledEvent`, `goLiveDate`.
- Each later task migrates its own callers and commits green: Task 4 (`mapEvents.ts` + its two tests), Task 5 (`EventLayer`), Task 9 (`EventComposer`), Task 10 (`AdminEventList`), Task 11 (`dropScheduledEvents` + its test). Task 14 deletes the old exports once no caller is left.

- [ ] **Step 1: Write the failing tests.** Add a new `describe` block to `eventWindow.test.ts`, leaving the existing cases in place; Task 14 removes them.

```ts
import {
  SOON_WINDOW_DAYS, daysUntilEvent, isPastEvent, localTodayIso,
  isFinishedEvent, isSoonEvent, isBeyondSoon,
} from '../eventWindow';

const NOW = new Date('2026-07-06T09:00:00');
const ev = (date: string, endDate: string | null = null) => ({ date, endDate });

describe('eventWindow — soon horizon and finished', () => {
  it('SOON_WINDOW_DAYS is 14', () => expect(SOON_WINDOW_DAYS).toBe(14));
  it('localTodayIso is the local calendar day', () => {
    expect(localTodayIso(new Date('2026-07-06T23:59:00'))).toBe('2026-07-06');
  });
  it('a single-day event is finished the day after', () => {
    expect(isFinishedEvent(ev('2026-07-06'), NOW)).toBe(false);
    expect(isFinishedEvent(ev('2026-07-05'), NOW)).toBe(true);
  });
  it('a multi-day event is finished only after its end date', () => {
    expect(isFinishedEvent(ev('2026-07-01', '2026-07-06'), NOW)).toBe(false);
    expect(isFinishedEvent(ev('2026-07-01', '2026-07-05'), NOW)).toBe(true);
  });
  it('soon = not finished and starting before day 14', () => {
    expect(isSoonEvent(ev('2026-07-06'), NOW)).toBe(true);
    expect(isSoonEvent(ev('2026-07-19'), NOW)).toBe(true); // day 13
    expect(isSoonEvent(ev('2026-07-20'), NOW)).toBe(false); // day 14
    expect(isSoonEvent(ev('2026-07-01', '2026-07-08'), NOW)).toBe(true); // running trip
    expect(isSoonEvent(ev('2026-07-05'), NOW)).toBe(false);
  });
  it('isBeyondSoon is day 14 and later', () => {
    expect(isBeyondSoon('2026-07-19', NOW)).toBe(false);
    expect(isBeyondSoon('2026-07-20', NOW)).toBe(true);
  });
  it('keeps daysUntilEvent and isPastEvent', () => {
    expect(daysUntilEvent('2026-07-10', NOW)).toBe(4);
    expect(isPastEvent('2026-07-05', NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run.** `npx vitest run src/components/CampusMap/__tests__/eventWindow.test.ts`. Expected: FAIL, because `SOON_WINDOW_DAYS` and the new functions are not exported.

- [ ] **Step 3: Implement.** In `eventWindow.ts`, add the code below after `hasFinished`. Change nothing else yet.

```ts
// The "soon" horizon: map pins and Novinky show events starting within it
// (today .. today+13). The catalog list (MapEventsSection) has no upper bound —
// a semester imported in September is visible in September.
export const SOON_WINDOW_DAYS = 14;

/** Local calendar day as YYYY-MM-DD — never toISOString(), which is UTC. */
export function localTodayIso(now: Date = new Date()): string {
  const d = startOfDay(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Dated = { date: string; endDate: string | null };

/** Over once its LAST day has passed — a five-day trip stays up all five days. */
export function isFinishedEvent(e: Dated, now: Date = new Date()): boolean {
  return daysUntilEvent(e.endDate ?? e.date, now) < 0;
}

/** Still on, and starting inside the soon horizon (a running trip counts). */
export function isSoonEvent(e: Dated, now: Date = new Date()): boolean {
  return !isFinishedEvent(e, now) && daysUntilEvent(e.date, now) < SOON_WINDOW_DAYS;
}

/** Starts on day 14 or later — outside what Novinky announces. */
export function isBeyondSoon(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) >= SOON_WINDOW_DAYS;
}
```

- [ ] **Step 4: Run the test and typecheck.** `npx vitest run src/components/CampusMap/__tests__/eventWindow && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/eventWindow.ts src/components/CampusMap/__tests__/eventWindow.test.ts
git commit -m "feat(events): soon horizon and end-date-aware finished check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `fetchMapEvents` returns the whole upcoming catalog, and `null` on error

**Files:**
- Modify: `src/api/mapEvents.ts:59-72`, `src/store/slices/createMapSlice.ts:327-342`, `src/store/types.ts` (MapSlice)
- Test: `src/api/__tests__/mapEvents.test.ts`, `src/api/__tests__/mapEvents.production.test.ts`, `src/store/slices/__tests__/createMapSlice.test.ts` (create it if absent)

**Interfaces:**
- Produces:
  - `fetchMapEvents(societies): Promise<MapEvent[] | null>`
  - slice state `mapEventsFetchedAt: number | null`
  - slice action `refreshMapEventsIfStale(minGapMs: number): Promise<void>`
- Consumes: `localTodayIso` and `isFinishedEvent` from Task 3

- [ ] **Step 1: Write the failing tests**

In `mapEvents.test.ts`:
- Replace any `isPublicEvent` import or usage with `isFinishedEvent`.
- Update the Supabase mock chain to `from().select().or().order()`.
- Add:

```ts
describe('fetchMapEvents — the catalog', () => {
  it('bounds the query to events not finished yet, and keeps far-future rows', async () => {
    const or = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [
        { ...base, id: 'far', date: '2099-11-23', end_date: '2099-11-29', venue_kind: 'tba', coord_lng: null, coord_lat: null, time: null },
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ or, order }) } as never);
    const events = await fetchMapEvents(BUNDLED_SOCIETIES);
    expect(or).toHaveBeenCalledWith(expect.stringMatching(/^date\.gte\.\d{4}-\d{2}-\d{2},end_date\.gte\.\d{4}-\d{2}-\d{2}$/));
    expect(events?.map((e) => e.id)).toEqual(['far']);
  });
  it('returns null — not [] — when the request fails', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ or: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }),
    } as never);
    expect(await fetchMapEvents(BUNDLED_SOCIETIES)).toBeNull();
  });
});
```

The existing test already mocks `../../services/spolky/supabaseClient`; reuse that mock. Put `base` at module scope if it is not already there.

In the slice test:

```ts
it('keeps the last list and loaded flag when a reload fails', async () => {
  const store = createTestStore(); // existing helper in src/test/ — grep createTestStore
  store.setState({ mapEvents: [someEvent], mapEventsLoaded: true });
  vi.mocked(fetchMapEvents).mockResolvedValueOnce(null);
  await store.getState().reloadMapEvents();
  expect(store.getState().mapEvents).toEqual([someEvent]);
  expect(store.getState().mapEventsLoaded).toBe(true);
});
it('refreshMapEventsIfStale refetches only after the gap', async () => {
  const store = createTestStore();
  vi.mocked(fetchMapEvents).mockResolvedValue([]);
  store.setState({ mapEventsFetchedAt: Date.now() });
  await store.getState().refreshMapEventsIfStale(60_000);
  expect(fetchMapEvents).not.toHaveBeenCalled();
  store.setState({ mapEventsFetchedAt: Date.now() - 61_000 });
  await store.getState().refreshMapEventsIfStale(60_000);
  expect(fetchMapEvents).toHaveBeenCalledTimes(1);
});
```

If there is no `createTestStore` helper, build the store the way the other slice tests under `src/store/slices/__tests__/` do. Copy their setup verbatim.

- [ ] **Step 2: Run.** `npx vitest run src/api/__tests__/mapEvents src/store/slices/__tests__/createMapSlice`. Expected: FAIL.

- [ ] **Step 3: Implement `fetchMapEvents`**

```ts
export async function fetchMapEvents(societies: Record<string, Society>): Promise<MapEvent[] | null> {
  // Bounded on the server to events not over yet (a multi-day trip counts until
  // its end date), so a device no longer downloads every past row. No upper
  // bound: the catalog shows the whole semester; pins and Novinky apply their
  // own 14-day horizon (eventWindow.SOON_WINDOW_DAYS).
  const today = localTodayIso();
  const { data, error } = await supabase
    .from('spolky_events')
    .select('*')
    .or(`date.gte.${today},end_date.gte.${today}`)
    .order('date', { ascending: true });

  // null, not []: a failed request must not read as "nothing is on" — the slice
  // keeps the last list (the same rule fetchNotifications follows).
  if (error) {
    logError('Api.fetchMapEvents', error);
    return null;
  }

  return (data ?? [])
    .map((row) => toMapEvent(row as SpolkyEventRow, societies))
    .filter((e) => !isFinishedEvent(e)); // local day; the server bound is UTC-agnostic but coarse
}
```

Replace the `isPublicEvent` import with `import { isFinishedEvent, localTodayIso } from '../components/CampusMap/eventWindow';`.

- [ ] **Step 4: Implement the slice.**
  - Add `mapEventsFetchedAt: number | null` and `refreshMapEventsIfStale: (minGapMs: number) => Promise<void>` to `MapSlice` in `src/store/types.ts`, beside `reloadMapEvents`.
  - Add `mapEventsFetchedAt: null` to the slice's initial state.
  - Change `reloadMapEvents` and add the new action:

```ts
  reloadMapEvents: async () => {
    try {
      const [events] = await Promise.all([fetchMapEvents(get().societies), get().loadSocieties()]);
      // A failed fetch keeps whatever is on screen: wiping it would show "no
      // events" on every network blip, and the resume refresh makes blips common.
      if (events === null) return;
      set({ mapEvents: events.map(locateEvent), mapEventsLoaded: true, mapEventsFetchedAt: Date.now() });
      void get().loadRsvps(events.map((e) => e.id));
    } catch (err) {
      logError('MapSlice.reloadMapEvents', err);
    }
  },

  // For a long-lived Capacitor process: the boot snapshot never refreshes on its
  // own, so resume calls this. The gap stops a quick tab-away-and-back from
  // refetching every time.
  refreshMapEventsIfStale: async (minGapMs) => {
    const at = get().mapEventsFetchedAt;
    if (at !== null && Date.now() - at < minGapMs) return;
    await get().reloadMapEvents();
  },
```

- [ ] **Step 5: Fix `mapEvents.production.test.ts`.** Replace its `isPublicEvent` usage with `isFinishedEvent({ date, endDate })`, and keep the assertion's intent: the production row maps, and a past row is finished.

- [ ] **Step 6: Run the tests and typecheck.** `npx vitest run src/api/__tests__/mapEvents src/store/slices/__tests__/createMapSlice && npm run typecheck`. Expected: PASS. Callers of `fetchMapEvents` other than the slice: grep `fetchMapEvents(`; each must handle `null`.

- [ ] **Step 7: Commit**

```bash
git add src/api/mapEvents.ts src/api/__tests__ src/store
git commit -m "feat(events): catalog fetch keeps future events; a failed fetch keeps the list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Pins only for soon events; remove the "scheduled" pin marker

**Files:**
- Modify: `src/components/CampusMap/EventLayer.tsx:46-91,205`, `src/components/CampusMap/EventPin.tsx:12,30,53-59`
- Test: `src/components/CampusMap/__tests__/EventLayer.test.tsx`, `EventPin.test.tsx`

**Interfaces:**
- Consumes: `isSoonEvent` from Task 3

- [ ] **Step 1: Write the failing test** in `EventLayer.test.tsx`, following its existing render setup. Seed `mapEvents` with one pinned event dated today+3 and one dated today+20 (both with coordinates). Assert that exactly one pin renders on the student map. With `adminConsoleOpen: true` and both in `societyMapEvents`, assert that two render. In `EventPin.test.tsx`, delete the `scheduled` / `data-scheduled` cases.

- [ ] **Step 2: Run.** `npx vitest run src/components/CampusMap/__tests__/EventLayer src/components/CampusMap/__tests__/EventPin`. Expected: FAIL (two pins).

- [ ] **Step 3: Implement.** In `EventLayer.tsx`:

```ts
  // Students' pins show what is on SOON: the catalog list carries the whole
  // semester, and a semester of pins would bury the campus. A society authoring
  // in the console still sees every one of its own events.
  const events = authoring ? societyEvents : publicEvents.filter((e) => isSoonEvent(e));
```

- Delete the `scheduled={...}` prop at line 205 and the `isScheduledEvent` import.
- In `EventPin.tsx`, delete the `scheduled` prop, its default, `data-scheduled`, and the two style ternaries (use `opacity: 1` and `border: '1px solid rgba(0,0,0,0.12)'`).

- [ ] **Step 4: Run the tests and typecheck.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/EventLayer.tsx src/components/CampusMap/EventPin.tsx src/components/CampusMap/__tests__
git commit -m "feat(map): pins show only events in the next 14 days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: A "Později (N)" section in the events list

**Files:**
- Modify: `src/components/CampusMap/eventHelpers.ts:38-78` (and the `relativeDayLabel` above/below), `src/components/CampusMap/MapEventsSection.tsx`, `src/store/types.ts`, `src/store/slices/createMapSlice.ts`, `src/i18n/locales/cs.json`, `en.json`
- Test: `src/components/CampusMap/__tests__/eventHelpers.test.ts`, `MapEventsSection.test.tsx`

**Interfaces:**
- Produces: `WeekSectionKey = 'thisWeek' | 'nextWeek' | 'later'`; slice `mapLaterExpanded: boolean`, `toggleMapLater: () => void`
- i18n: `map.later` = "Později" / "Later"

- [ ] **Step 1: Write the failing tests.** In `eventHelpers.test.ts`:

```ts
it('buckets day 14 and later into "later"', () => {
  const now = new Date('2026-07-06T09:00:00');
  const s = weekSections([ev('a', '2026-07-07'), ev('b', '2026-07-15'), ev('c', '2026-07-20'), ev('d', '2026-11-23')], now);
  expect(s.map((x) => [x.key, x.events.map((e) => e.id)])).toEqual([
    ['thisWeek', ['a']], ['nextWeek', ['b']], ['later', ['c', 'd']],
  ]);
});
it('labels later events with weekday and date', () => {
  const now = new Date('2026-07-06T09:00:00');
  expect(relativeDayLabel('2026-11-19', 'cs-CZ', (k) => k, now)).toBe('Čt 19. 11.');
});
```

Use the file's existing `ev()` fixture helper if there is one; otherwise define `const ev = (id: string, date: string) => ({ ...BASE_EVENT, id, date })` from its existing base.

In `MapEventsSection.test.tsx`: seed one event 3 days out and two 30 days out. Assert that the heading `Později (2)` renders as a button and that the two later rows are **not** in the document. Click the button, then assert both rows render.

- [ ] **Step 2: Run.** `npx vitest run src/components/CampusMap/__tests__/eventHelpers src/components/CampusMap/__tests__/MapEventsSection`. Expected: FAIL.

- [ ] **Step 3: Implement `weekSections`**. Update the comment above it to say there are three buckets, then:

```ts
export type WeekSectionKey = 'thisWeek' | 'nextWeek' | 'later';
...
export function weekSections(events: MapEvent[], now: Date = new Date()): WeekSection[] {
  const day0 = startOfDay(now).getTime();
  const bucketOf = (e: MapEvent): WeekSectionKey => {
    const t = parseEventDate(e.date).getTime();
    if (t < day0 + 7 * 86400_000) return 'thisWeek';
    if (t < day0 + 14 * 86400_000) return 'nextWeek';
    return 'later';
  };
  const buckets = new Map<WeekSectionKey, MapEvent[]>();
  for (const e of sortByDate(events)) {
    const k = bucketOf(e);
    const arr = buckets.get(k);
    if (arr) arr.push(e);
    else buckets.set(k, [e]);
  }
  const order: WeekSectionKey[] = ['thisWeek', 'nextWeek', 'later'];
  return order.filter((k) => buckets.has(k)).map((k) => ({ key: k, events: buckets.get(k)! }));
}
```

A multi-day event that started before today sits in `thisWeek`, because its date is earlier than day 7.

In `relativeDayLabel`, add this before the final `return`:

```ts
  // Beyond two weeks a weekday alone says nothing; the locale orders the parts
  // ("Čt 19. 11." in Czech, "Thu, 11/19" in English for the Erasmus students).
  if (days >= 14) {
    return cap(date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));
  }
```

Add a second assertion to the Step 1 test: `expect(relativeDayLabel('2026-11-19', 'en-US', (k) => k, now)).toBe('Thu, 11/19')`. If the Node ICU output differs (for example a narrow no-break space), assert `toMatch(/^Thu,?\s11\/19$/)` instead.

- [ ] **Step 4: Slice state.** Add `mapLaterExpanded: boolean` and `toggleMapLater: () => void` to `MapSlice`. In `createMapSlice`, add `mapLaterExpanded: false` and `toggleMapLater: () => set((s) => ({ mapLaterExpanded: !s.mapLaterExpanded }))`.

- [ ] **Step 5: Implement `MapEventsSection`.** Replace the heading `<div>` in the `sections.map` with:

```tsx
            <div key={s.key}>
              {s.key === 'later' ? (
                <button
                  type="button"
                  onClick={toggleLater}
                  aria-expanded={laterExpanded}
                  className="flex w-full items-center gap-1 border-l-2 border-transparent px-3 pb-1 pt-2 text-left text-[11px] font-bold uppercase tracking-wide text-base-content/60"
                >
                  {laterExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {t('map.later')} ({s.events.length})
                </button>
              ) : (
                <div className="border-l-2 border-transparent px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
                  {t(`map.${s.key}`)}
                </div>
              )}
              {(s.key !== 'later' || laterExpanded) &&
                s.events.map((e) => (/* existing <EventRow …/> unchanged */))}
            </div>
```

Read the state with `const laterExpanded = useAppStore((s) => s.mapLaterExpanded); const toggleLater = useAppStore((s) => s.toggleMapLater);`, and import `ChevronDown` and `ChevronRight` from `lucide-react`. Update the file's top comment ("grouped into This week / Next week / Later, the last collapsed").

- [ ] **Step 6: i18n.** Add `"later": "Později"` to `cs.json` under `map`, and `"later": "Later"` to `en.json`.

- [ ] **Step 7: Run the tests and typecheck.** Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/CampusMap src/store src/i18n
git commit -m "feat(events): collapsible Later section holds the rest of the semester

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: The society's Instagram handle, read and edited

**Files:**
- Modify: `src/types/events.ts` (Society), `src/api/societies.ts:9-50`, `src/api/societiesAdmin.ts:14-21,53-62,65-80`, `src/store/slices/societies/saveSociety.ts:49-57`, `src/components/AdminConsole/societyFormRules.ts`, `src/components/AdminConsole/SocietyForm.tsx`, locales
- Test: `src/api/__tests__/societies.test.ts`, `src/api/__tests__/societiesAdmin.test.ts`, `src/components/AdminConsole/__tests__/societyFormRules.test.ts` (create it if absent)

**Interfaces:**
- Produces:
  - `Society.instagram?: string`
  - `SocietyRow.instagram: string | null`
  - `SocietyInput.instagram: string | null`
  - `normalizeInstagram(raw: string): string | null | 'invalid'`
- i18n: `admin.societies.instagram` "Instagram" / "Instagram"; `admin.societies.instagramHint` "Jen jméno účtu, např. esnmendelubrno" / "Account name only, e.g. esnmendelubrno"; `admin.societies.errors.instagram` "Neplatné jméno účtu na Instagramu" / "Not a valid Instagram account name"

- [ ] **Step 1: Write the failing tests**

```ts
// societyFormRules.test.ts
import { normalizeInstagram } from '../societyFormRules';
describe('normalizeInstagram', () => {
  it('strips @ and whitespace', () => expect(normalizeInstagram('  @esnmendelubrno ')).toBe('esnmendelubrno'));
  it('empty means none', () => expect(normalizeInstagram('  ')).toBeNull());
  it('accepts a profile URL and keeps only the handle', () =>
    expect(normalizeInstagram('https://www.instagram.com/led_zf/')).toBe('led_zf'));
  it('rejects anything the database would', () => {
    expect(normalizeInstagram('a/b')).toBe('invalid');
    expect(normalizeInstagram('x'.repeat(31))).toBe('invalid');
  });
});
```

In `societies.test.ts`, assert that `rowToSociety({ ...row, instagram: 'esnmendelubrno' }).instagram === 'esnmendelubrno'`, that `instagram: null` yields no `instagram` key, and that `SOCIETY_COLUMNS` contains `instagram`.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement**
  - `Society` in `src/types/events.ts`: add `/** Instagram handle without @ — the "details" link on events that have none. */ instagram?: string;`
  - `SocietyRow`: add `instagram: string | null;`. Append `, instagram` to `SOCIETY_COLUMNS`. In `rowToSociety`, add `...(row.instagram ? { instagram: row.instagram } : {}),`.
  - `societiesAdmin.ts`: add `instagram: string | null` to `SocietyInput`, add `instagram: null` to `devRow`, and add `instagram: input.instagram` to the `insertSociety` row.
  - `saveSociety.ts`: add `instagram: input.instagram,` to the update patch.
  - `societyFormRules.ts`:

```ts
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
/** The handle to store, null for none, or 'invalid'. Same rule as the DB CHECK. */
export function normalizeInstagram(raw: string): string | null | 'invalid' {
  let s = raw.trim();
  if (!s) return null;
  const url = /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(s);
  if (url) s = url[1];
  s = s.replace(/^@/, '');
  return HANDLE_RE.test(s) ? s : 'invalid';
}
```

- In `SocietyForm.tsx`:
  - Add `const [instagram, setInstagram] = useState(society?.instagram ?? '');`.
  - In `submit`, before `validateSocietyDraft`, add `const ig = normalizeInstagram(instagram); if (ig === 'invalid') return setError('errors.instagram');`.
  - Pass `instagram: ig` into the `saveSociety({ … })` input.
  - Add the field after the short name, using the existing `field` class:

```tsx
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.instagram')}</span>
        <input className="input input-bordered w-full" value={instagram}
          placeholder="esnmendelubrno" onChange={(e) => setInstagram(e.target.value)} />
        <span className="text-xs text-base-content/70">{t('admin.societies.instagramHint')}</span>
      </label>
```

`released` holder saves spread an existing `Society` into `saveSociety`. Make sure they pass `instagram: released.instagram ?? null`.

- [ ] **Step 4: i18n.** Add the three keys to both locale files.

- [ ] **Step 5: Run the tests.** `npx vitest run src/api/__tests__/societies src/components/AdminConsole/__tests__/societyForm`. Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/types/events.ts src/api/societies.ts src/api/societiesAdmin.ts src/api/__tests__ src/store/slices/societies src/components/AdminConsole src/i18n
git commit -m "feat(admin): a society's Instagram handle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: "Místo upřesní …" and the Instagram button on the row and the card

**Files:**
- Create: `src/components/CampusMap/EventVenueLine.tsx`, `src/components/CampusMap/eventLinks.ts`
- Modify: `src/components/CampusMap/EventDetailCard.tsx:121-195`, `src/components/CampusMap/EventRow.tsx:71-76`, locales
- Test: `src/components/CampusMap/__tests__/eventLinks.test.ts` (new), `EventDetailCard.test.tsx`, `EventRow.test.tsx`

**Interfaces:**
- Produces:
  - `eventDetailsLink(event: Pick<MapEvent,'url'>, society: Pick<Society,'instagram'>): { href: string; kind: 'event' | 'instagram' } | null`
  - `<EventVenueLine event={MapEvent} societyShortName={string} />`
- i18n:
  - `map.venueTba` = "Místo upřesní {name}" / "Venue TBA by {name}"
  - `map.moreOnInstagram` = "Více na Instagramu" / "More on Instagram"

- [ ] **Step 1: Write the failing tests**

```ts
// eventLinks.test.ts
import { eventDetailsLink } from '../eventLinks';
describe('eventDetailsLink', () => {
  it("prefers the event's own url", () =>
    expect(eventDetailsLink({ url: 'https://esn.cz/e' }, { instagram: 'x' })).toEqual({ href: 'https://esn.cz/e', kind: 'event' }));
  it("falls back to the society's Instagram", () =>
    expect(eventDetailsLink({ url: '' }, { instagram: 'esnmendelubrno' })).toEqual({ href: 'https://www.instagram.com/esnmendelubrno/', kind: 'instagram' }));
  it('ignores an unsafe event url and still falls back', () =>
    expect(eventDetailsLink({ url: 'javascript:alert(1)' }, { instagram: 'a' })?.kind).toBe('instagram'));
  it('never builds a link from an invalid handle', () =>
    expect(eventDetailsLink({ url: '' }, { instagram: 'a/b' })).toBeNull());
  it('null with neither', () => expect(eventDetailsLink({ url: '' }, {})).toBeNull());
});
```

- In `EventDetailCard.test.tsx`, add two cases, following the existing setup that seeds a society in the store:
  - A `tba` event with no url, whose society has `instagram: 'esnmendelubrno'`, renders the text `Místo upřesní ESN` and a link named `Více na Instagramu` pointing at `https://www.instagram.com/esnmendelubrno/`.
  - The same event with `url: 'https://esn.cz/e'` renders `Více informací` pointing at the event url.
- In `EventRow.test.tsx`, a `tba` event renders `Místo upřesní ESN`. Pass a society via the store, the same way the card test does.

- [ ] **Step 2: Run.** `npx vitest run src/components/CampusMap/__tests__/eventLinks src/components/CampusMap/__tests__/EventDetailCard src/components/CampusMap/__tests__/EventRow`. Expected: FAIL.

- [ ] **Step 3: Implement `eventLinks.ts`**

```ts
import { validateExternalUrl } from '../../mobile/openExternal';
import type { MapEvent, Society } from '../../types/events';

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Where "details" goes: the event's own link when it has a safe one, otherwise
 * the society's Instagram — for an event imported from a semester poster, that
 * is where the time and place get announced. The handle is re-checked here
 * because it is data from Supabase, not something the app typed.
 */
export function eventDetailsLink(
  event: Pick<MapEvent, 'url'>,
  society: Pick<Society, 'instagram'>
): { href: string; kind: 'event' | 'instagram' } | null {
  if (event.url && validateExternalUrl(event.url)) return { href: event.url, kind: 'event' };
  if (society.instagram && HANDLE_RE.test(society.instagram))
    return { href: `https://www.instagram.com/${society.instagram}/`, kind: 'instagram' };
  return null;
}
```

- [ ] **Step 4: Implement `EventVenueLine.tsx`.**
  - Move `EventDetailCard.tsx` lines 121–173 (the `event.roomCode ? … : event.coord ? … : venueName ? … : null` block) into this component verbatim, together with the `venueName` computation and its comment, and the imports it uses: `MapPin`, `Navigation`, `useAppStore` (for `focusRoomByCode`), `roomsIndexJson`, `roomCodeToName`, `getPlatform`, `openVenue`, `openExternal`, `logError`, `venueMapUrl`.
  - Replace the final `: null` branch with the code below.
  - Export `function EventVenueLine({ event, societyShortName }: { event: MapEvent; societyShortName: string })`, and inside it call `const { t } = useTranslation();` (import from `../../hooks/useTranslation`). The TBA branch below uses `t`.

```tsx
          ) : event.venueKind === 'tba' ? (
            // Imported from a semester list: the society has not said where yet.
            // Muted and inert, because there is nowhere to go.
            <div className="flex items-center gap-1.5 text-sm text-base-content/60">
              <MapPin size={13} className="shrink-0 opacity-60" />
              {t('map.venueTba', { name: societyShortName })}
            </div>
          ) : null}
```

- [ ] **Step 5: Use both in `EventDetailCard.tsx`.**
  - Replace the moved block with `<EventVenueLine event={event} societyShortName={soc.shortName} />`.
  - Replace the bottom `event.url && validateExternalUrl(event.url) && (<a …>)` with:

```tsx
        {details && (
          <a href={details.href} target="_blank" rel="noopener noreferrer" onClick={openInApp}
            className="btn btn-primary btn-sm btn-block">
            {details.kind === 'instagram' ? t('map.moreOnInstagram') : t('map.moreInfo')}{' '}
            <ExternalLink size={13} />
          </a>
        )}
```

  - Compute `const details = eventDetailsLink(event, soc);` near the top.
  - Remove the imports that are now unused.
  - Confirm with `wc -l` that `EventDetailCard.tsx` is under 200 lines.

- [ ] **Step 6: `EventRow.tsx`.** After the existing venue `span` (line 71–76), add:

```tsx
          {!event.location && !event.coord && event.venueKind === 'tba' && societyShortName && (
            <span className="mt-0.5 block truncate text-[11px] text-base-content/60">
              {t('map.venueTba', { name: societyShortName })}
            </span>
          )}
```

Get `societyShortName` by adding `const soc = useSociety(event.societyId);` (from `../../hooks/useSociety`) and passing `soc?.shortName`. `EventRow` currently takes `t` as a prop with the signature `(k: string) => string`. Widen it to `(k: string, p?: Record<string, string | number>) => string`, and check that its callers pass the hook's `t`, which already accepts params.

- [ ] **Step 7: i18n.** Add `map.venueTba` and `map.moreOnInstagram` to both locales.

- [ ] **Step 8: Run the tests.** Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap src/i18n
git commit -m "feat(events): place-TBA line and Instagram details button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: The composer saves events without a place or time, and with an end date

**Files:**
- Create: `src/components/CampusMap/composerRules.ts`, `src/components/CampusMap/ComposerWhenField.tsx`
- Modify: `src/components/CampusMap/EventComposer.tsx`, `src/components/CampusMap/composerPost.ts:5-29`, locales
- Test: `src/components/CampusMap/__tests__/composerRules.test.ts` (new), `composerPost.test.ts`, `EventComposer.test.tsx`

**Interfaces:**
- Produces:
  - `isComposerReady(d: { title: string; date: string; endDate: string; urlInvalid: boolean }): boolean`
  - `deriveVenue(room: { code: string } | null, coord: [number, number] | null): 'campus' | 'offcampus' | 'tba'`
  - `buildPostInput(d: ComposerDraft): PostInput`, where

```ts
interface ComposerDraft {
  title: string; description: string; category: EventCategory; date: string; endDate: string;
  time: string; room: { code: string; coord: [number, number] } | null;
  coord: [number, number] | null; placeName: string | null; url: string; subscribersOnly: boolean;
}
```

- i18n:
  - `map.endDate` = "Konec (vícedenní akce)" / "Ends (multi-day event)"
  - `map.endBeforeStart` = "Konec je před začátkem" / "Ends before it starts"

- [ ] **Step 1: Write the failing tests**

```ts
// composerRules.test.ts
import { isComposerReady, deriveVenue, buildPostInput } from '../composerRules';
const draft = {
  title: 'Pub Quiz', description: '', category: 'quiz' as const, date: '2026-10-13', endDate: '',
  time: '', room: null, coord: null, placeName: null, url: '', subscribersOnly: false,
};
describe('composerRules', () => {
  it('needs only a title and a date', () => {
    expect(isComposerReady({ title: 'x', date: '2026-10-13', endDate: '', urlInvalid: false })).toBe(true);
    expect(isComposerReady({ title: ' ', date: '2026-10-13', endDate: '', urlInvalid: false })).toBe(false);
    expect(isComposerReady({ title: 'x', date: '', endDate: '', urlInvalid: false })).toBe(false);
  });
  it('rejects an end date before the start and a bad url', () => {
    expect(isComposerReady({ title: 'x', date: '2026-10-13', endDate: '2026-10-12', urlInvalid: false })).toBe(false);
    expect(isComposerReady({ title: 'x', date: '2026-10-13', endDate: '', urlInvalid: true })).toBe(false);
  });
  it('derives the venue kind', () => {
    expect(deriveVenue({ code: 'Q01' }, [16, 49])).toBe('campus');
    expect(deriveVenue(null, [16, 49])).toBe('offcampus');
    expect(deriveVenue(null, null)).toBe('tba');
  });
  it('builds a tba input with nulls, and end date only when set', () => {
    const i = buildPostInput(draft);
    expect(i).toMatchObject({ venueKind: 'tba', time: null, roomCode: null, coordLng: null, coordLat: null, location: null, url: null, endDate: null });
    expect(buildPostInput({ ...draft, endDate: '2026-10-15' }).endDate).toBe('2026-10-15');
  });
  it('an end date equal to the start is stored as none', () =>
    expect(buildPostInput({ ...draft, endDate: '2026-10-13' }).endDate).toBeNull());
});
```

In `composerPost.test.ts`, update the assertion that the patch has **no** `end_date` key. The patch now carries `end_date: input.endDate ?? null` and still has no `visible_from`.

In `EventComposer.test.tsx`, add: fill in only the title and date, click Publish, and assert that `createPost` was called with `venueKind: 'tba'` and `time: null`. Delete any test that asserts the "zveřejní se" note, or that Publish is disabled without a time or place.

- [ ] **Step 2: Run.** `npx vitest run src/components/CampusMap/__tests__/composerRules src/components/CampusMap/__tests__/composerPost src/components/CampusMap/__tests__/EventComposer`. Expected: FAIL.

- [ ] **Step 3: Implement `composerRules.ts`**

```ts
import { validateExternalUrl } from '../../mobile/openExternal';
import type { PostInput } from '../../api/societyPosts';
import type { EventCategory } from '../../types/events';

export interface ComposerDraft {
  title: string; description: string; category: EventCategory; date: string; endDate: string;
  time: string; room: { code: string; coord: [number, number] } | null;
  coord: [number, number] | null; placeName: string | null; url: string; subscribersOnly: boolean;
}

// A society publishes what it knows. A semester list has a title and a date;
// the place and time follow later (venue_kind 'tba', time null).
export function isComposerReady(d: { title: string; date: string; endDate: string; urlInvalid: boolean }): boolean {
  if (!d.title.trim() || !d.date || d.urlInvalid) return false;
  return !d.endDate || d.endDate >= d.date;
}

export function deriveVenue(
  room: { code: string } | null,
  coord: [number, number] | null
): 'campus' | 'offcampus' | 'tba' {
  return room ? 'campus' : coord ? 'offcampus' : 'tba';
}

export const isUrlInvalid = (url: string) => url.trim() !== '' && !validateExternalUrl(url.trim());

export function buildPostInput(d: ComposerDraft): PostInput {
  const venueKind = deriveVenue(d.room, d.coord);
  return {
    title: d.title.trim(),
    body: d.description.trim(),
    category: d.category,
    date: d.date,
    endDate: d.endDate && d.endDate > d.date ? d.endDate : null,
    time: d.time || null,
    venueKind,
    roomCode: d.room?.code ?? null,
    coordLng: d.coord?.[0] ?? null,
    coordLat: d.coord?.[1] ?? null,
    location: d.room ? null : d.placeName,
    url: d.url.trim() || null,
    subscribersOnly: d.subscribersOnly,
  };
}
```

- [ ] **Step 4: `composerPost.toPatch`.** Add `end_date: input.endDate ?? null,` and rewrite the doc comment: the composer now has an end-date field, so the patch writes it. It still never writes `visible_from`.

- [ ] **Step 5: `ComposerWhenField.tsx`.** Move the "When" block out of `EventComposer.tsx` (the `<label>{t('map.eventWhen')}</label>` through the `MiniCalendar` + `ComposerTimeField` row), and delete the `scheduled`/`goLiveDate` note. Add the end date:

```tsx
export function ComposerWhenField({ date, time, endDate, onDate, onTime, onEndDate, t, locale }: {
  date: string; time: string; endDate: string;
  onDate: (v: string) => void; onTime: (v: string) => void; onEndDate: (v: string) => void;
  t: (k: string) => string; locale: string;
}) {
  const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';
  return (
    <>
      <label className={LABEL}>{t('map.eventWhen')}</label>
      {/* moved verbatim from EventComposer: date + time row with its comment */}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 grow-[3] basis-48">
          <MiniCalendar value={date || null} onChange={onDate} placeholder={t('map.selectDate')} t={t} locale={locale} />
        </div>
        <div className="min-w-0 grow basis-32">
          <ComposerTimeField value={time} onChange={onTime} t={t} />
        </div>
      </div>
      <label className={LABEL}>{t('map.endDate')}</label>
      <MiniCalendar value={endDate || null} onChange={onEndDate} placeholder={t('map.selectDate')} t={t} locale={locale} />
      {endDate && date && endDate < date && (
        <p className="mt-1 text-[11px] text-error">{t('map.endBeforeStart')}</p>
      )}
    </>
  );
}
```

If `MiniCalendar` has no way to clear a picked date, pass `onChange` and add a small "✕" `btn btn-ghost btn-xs` beside it that calls `onEndDate('')`. Check `MiniCalendar`'s props first.

- [ ] **Step 6: `EventComposer.tsx`**
  - Add `const [endDate, setEndDate] = useState(duplicating ? '' : (source?.endDate ?? ''));`.
  - Replace `urlInvalid` and `ready` (lines 89–93) with:
    - `const urlInvalid = isUrlInvalid(url);`
    - `const ready = isComposerReady({ title, date, endDate, urlInvalid });`
  - Delete the `scheduled` const and the `isScheduledEvent, goLiveDate` import.
  - In `publish`:
    - Change the guard to `if (!ready || busy || !associationId) return;`.
    - Replace the `input` literal with `buildPostInput({ title, description, category, date, endDate, time, room, coord, placeName, url, subscribersOnly })`.
    - Change the toast to `editId ? t('map.toastSaved') : t('map.toastPublished')`.
  - Replace the When block with `<ComposerWhenField … />`.
  - Update the header comment: "The venue KIND is derived, never asked: a picked room makes a campus event, a searched place or a hand-dropped pin an off-campus one, and no place at all a 'tba' one."
  - Delete the `map.toastScheduled`, `map.goesLive` and `map.scheduled` keys **only if** a grep finds no remaining reader after Task 10.
  - Confirm `wc -l src/components/CampusMap/EventComposer.tsx` is ≤ 230. If it is over, also move the URL `<label>`/`<input>`/`urlInvalid` message into a `ComposerLinkField.tsx` using the same pattern.

- [ ] **Step 7: i18n.** Add `map.endDate` and `map.endBeforeStart` to both locales.

- [ ] **Step 8: Run the tests, then typecheck.** `npx vitest run src/components/CampusMap && npm run typecheck`. Expected: PASS, apart from the callers Tasks 10–11 still own.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap src/i18n
git commit -m "feat(composer): publish without a place or time; optional end date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Admin console: Upcoming/Past, "Bez místa", and the interest count

**Files:**
- Modify: `src/components/AdminConsole/AdminEventList.tsx:84-96,142-150`, `src/components/AdminConsole/EventStats.tsx`, `src/store/slices/createAdminSlice.ts:225-240`, `src/store/types.ts` (Admin slice), locales
- Test: `src/components/AdminConsole/__tests__/AdminEventList.test.tsx`, `AdminEventStats.test.tsx`

**Interfaces:**
- Consumes: `isFinishedEvent` (Task 3), `fetchEventRsvps` (`src/api/eventRsvp.ts`, which returns `{ counts: Record<string,{going:number;interested:number}>, ok: boolean }`)
- Produces: slice state `societyRsvpCounts: Record<string, { going: number; interested: number }>`
- i18n:
  - `map.upcoming` = "Nadcházející" / "Upcoming"
  - `admin.noVenue` = "Bez místa" / "No place yet"
  - `admin.eventInterest` = "Zájem v reIS: {count}" / "Interested in reIS: {count}"

- [ ] **Step 1: Write the failing tests**
  - `AdminEventList.test.tsx`:
    - Seed three events: today, today+30 and yesterday. Assert the headings `Nadcházející` (with two rows) and `Proběhlé` (with one), and that `Naplánované` is absent.
    - Seed one `tba` event and assert its row shows `Bez místa`.
    - Delete the existing tests for the Scheduled bucket and the "zveřejní se" subline.
  - `AdminEventStats.test.tsx`: with `societyRsvpCounts: { e1: { going: 2, interested: 5 } }` and a post whose counts are set, assert that `Zájem v reIS: 7` renders.

- [ ] **Step 2: Run.** `npx vitest run src/components/AdminConsole/__tests__/AdminEvent`. Expected: FAIL.

- [ ] **Step 3: Slice.** Add `societyRsvpCounts: Record<string, RsvpCounts>` to the admin slice type, with initial value `{}`. In `loadSocietyPosts`, after `set({ societyPosts: posts })`:

```ts
    // Interest per event, from the same public aggregate RPC the student card
    // uses — no new data flow. Not attendance: RSVPs count installs, and free
    // events see many no-shows, which is why the label says "v reIS".
    const { counts, ok } = await fetchEventRsvps(posts.map((p) => p.id));
    if (ok && get().adminActiveAssociationId === associationId) set({ societyRsvpCounts: counts });
```

- [ ] **Step 4: `EventStats.tsx`.** Read `const interest = useAppStore((s) => s.societyRsvpCounts[eventId]);`, and after the clicks span add:

```tsx
      {interest && (
        <span className="flex items-center gap-1">
          <Users size={11} className="flex-shrink-0" aria-hidden />
          <span>{t('admin.eventInterest', { count: interest.going + interest.interested })}</span>
        </span>
      )}
```

Import `Users` from `lucide-react`. Update the header comment to list the third number and its caveat.

- [ ] **Step 5: `AdminEventList.tsx`**. Replace lines 84–96 with:

```ts
  const past = sortByDate(events.filter((e) => isFinishedEvent(e))).reverse();
  const upcoming = sortByDate(events.filter((e) => !isFinishedEvent(e)));
  const subline = (e: MapEvent) => {
    const day = `${relativeDayLabel(e.date, locale, t)}${e.time ? ` · ${e.time}` : ''}`;
    if (hasFinished(e)) return `${day} · ${t('map.finished')}`;
    if (e.venueKind === 'tba') return `${day} · ${t('admin.noVenue')}`;
    return undefined;
  };
```

- Replace the three `section(...)` calls with `{section(t('map.upcoming'), upcoming, subline)}` and `{section(t('map.past'), past)}`, and pass `[...upcoming, ...past]` to `EventStatsNote`.
- Drop the `stats` parameter from `section` (always true), the `goLive` helper, and the `isPastEvent, isScheduledEvent, goLiveDate` imports. Import `isFinishedEvent, hasFinished`.
- Update the header comment: the buckets are now "Upcoming = everything not over, which students see in the catalog; pins and Novinky show it from 14 days out", and Past.

- [ ] **Step 6: i18n.** Add the three keys. Then grep for `map.liveNow`, `map.scheduled`, `map.goesLive` and `map.toastScheduled`, and delete any key with no remaining reader from both locales.

- [ ] **Step 7: Run the tests and typecheck.** Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminConsole src/store src/i18n
git commit -m "feat(admin): Upcoming and Past only; 'Bez místa'; interest count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Novinky, a bounded query with a limit of 200, keeping trips that are still running

**Files:**
- Modify: `src/services/spolky/spolkyService.ts:66-102`, `src/services/spolky/dropScheduledEvents.ts`
- Test: `src/services/spolky/__tests__/spolkyService.fetch.test.ts`, `dropScheduledEvents.test.ts`

**Interfaces:**
- Consumes: `localTodayIso`, `isBeyondSoon`, `SOON_WINDOW_DAYS` from Task 3

- [ ] **Step 1: Write the failing tests.** In `spolkyService.fetch.test.ts`, capture the builder calls, following the file's existing mock style. Assert:
  - `.or()` is called with `date.gte.<today>,end_date.gte.<today>`
  - `.lte('date', <today+13>)`
  - `.limit(200)`
  - the existing `visible_from` `.or()` is still applied

  In `dropScheduledEvents.test.ts`, switch the import to use `isBeyondSoon` semantics. The day-14 case is dropped and day 13 is kept; only the function name inside changes, and the tests stay behaviourally identical.

- [ ] **Step 2: Run.** `npx vitest run src/services/spolky/__tests__`. Expected: FAIL on `.lte`, `limit(200)` and the date `or`.

- [ ] **Step 3: Implement.** In `fetchNotifications`:

```ts
    // Bounded to the soon horizon on the SERVER: the limit is applied before the
    // device keeps only followed societies (follows never leave the device), so
    // an unbounded list of whole imported semesters would push a small society's
    // next event off the end. A trip still running (end_date >= today) stays.
    const today = localTodayIso();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + SOON_WINDOW_DAYS - 1);
    const now = new Date().toISOString();
    // ONE .or() with nested and(): whether PostgREST ANDs two separate `or`
    // params was not verified, so the whole condition is written unambiguously.
    const visible = `or(visible_from.is.null,visible_from.lte.${now})`;
    const { data, error } = await supabase
      .from('spolky_events')
      .select('id, association_id, title, body, url, created_at, date, end_date')
      .lte('date', localTodayIso(horizon))
      .or(`and(date.gte.${today},${visible}),and(end_date.gte.${today},${visible})`)
      .order('date', { ascending: true })
      .limit(200);
```

Update the Step 1 assertion to match: one `.or()` call with that string, plus `.lte('date', …)`. Then run it once read-only against production to confirm that PostgREST accepts the nested syntax and that it returns rows:

```bash
curl -s "<SUPABASE_URL from src/services/supabase/config.ts>/rest/v1/spolky_events?select=id,date&date=lte.<today+13>&or=(and(date.gte.<today>,or(visible_from.is.null,visible_from.lte.<now>)),and(end_date.gte.<today>,or(visible_from.is.null,visible_from.lte.<now>)))" -H "apikey: <publishable key from src/services/supabase/config.ts>"
```

Expected: a JSON array, not a PGRST error. The publishable key is public by design. In `dropScheduledEvents.ts`, change the import to `isBeyondSoon` and use `return !isBeyondSoon(day, now);`, and update the comment: the 14-day rule is now Novinky's own horizon, not "goes live".

- [ ] **Step 4: Run the tests and typecheck.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/spolky
git commit -m "fix(novinky): bound the feed to the soon horizon before the follow filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: A Novinky tap opens the event card, with the link as fallback

**Files:**
- Modify: `src/hooks/useOpenNotification.ts:75-117`
- Test: `src/components/NotificationFeed.test.tsx`, `src/components/mobile/sheets/__tests__/NotificationsSheetEvents.test.tsx`

- [ ] **Step 1: Write the failing tests.** In both test files:
  - An event row **with** `link: 'https://esn.cz/e'` whose id is in `mapEvents` now calls `focusEventById(id, { fly: true })` and does **not** call `openExternal`.
  - A row with a link and no matching map event (an `academic_*` row) still calls `openExternal`.
  - Update the existing tests that asserted that a linked event opens the link.

- [ ] **Step 2: Run.** `npx vitest run src/components/NotificationFeed src/components/mobile/sheets/__tests__/NotificationsSheetEvents`. Expected: FAIL.

- [ ] **Step 3: Implement.** Replace the body of `openNotification` with the version below. Keep `track`, `activationRef`, `openingRef` and their comments.

```ts
  const openNotification = async (n: SpolekNotification) => {
    const track = () => {
      if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
    };
    const openLink = (link: string) => {
      track();
      // openExternal, not window.open: on Capacitor the system browser has no IS
      // session, and a notification's URL is data from outside the app.
      void openExternal(link);
      onClose();
    };
    // Academic rows are deadlines, not places: straight to the link.
    if (n.link && n.associationId?.startsWith('academic_')) {
      activationRef.current += 1;
      openingRef.current = false;
      return openLink(n.link);
    }
    if (openingRef.current) return;
    openingRef.current = true;
    const activation = (activationRef.current += 1);
    try {
      if (!mapEventsLoaded) await loadMapEvents();
      if (activationRef.current !== activation) return;
      // The CARD first, even when the event has a URL: the card carries the
      // RSVP, the venue and the reminder, and the URL is its button. Jumping
      // straight to the link cost every linked event its RSVPs.
      if (useAppStore.getState().mapEvents.some((e) => e.id === n.id)) {
        track();
        focusEventById(n.id, { fly: true });
        showMap();
        onClose();
        return;
      }
      if (n.link) openLink(n.link);
    } finally {
      if (activationRef.current === activation) openingRef.current = false;
    }
  };
```

Update the hook's doc comment: the paragraph "The link keeps priority where it exists…" becomes "The card has priority; the link is the fallback for rows with no event (academic deadlines)."

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOpenNotification.ts src/components/NotificationFeed.test.tsx src/components/mobile/sheets
git commit -m "fix(novinky): a tap opens the event card; the link is the fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Reload events on Capacitor resume; parity guard; verification; PR

**Files:**
- Modify: `capacitor/startApp.ts:119-123`
- Create: `src/test/guards/eventsResumeRefreshIsCapacitorOnly.test.ts`

- [ ] **Step 1: Write the guard test.** It records the deliberate host difference, following `desktopHasNoShowOnMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Events reload on RESUME only in the Capacitor app. The extension needs no
// equivalent: its iframe is rebuilt on every IS page load, so it fetches fresh
// events each time. Named paths clear the tree-parity hook for these files.
describe('events refresh on resume is Capacitor-only, on purpose', () => {
  it('capacitor/startApp.ts refreshes map events on resume', () => {
    const src = readFileSync('capacitor/startApp.ts', 'utf8');
    expect(src).toMatch(/addListener\('resume'[\s\S]*refreshMapEventsIfStale/);
  });
});
```

- [ ] **Step 2: Run.** `npx vitest run src/test/guards/eventsResumeRefreshIsCapacitorOnly`. Expected: FAIL.

- [ ] **Step 3: Implement.** In the resume listener, after `loadSocieties()`:

```ts
    // Same staleness, for events: a society's new, moved or cancelled event
    // otherwise never reaches a long-lived app process. Gap-limited like the
    // IS sync, so tabbing away and back does not refetch every time.
    void useAppStore.getState().refreshMapEventsIfStale(MIN_SYNC_GAP);
```

`MIN_SYNC_GAP` comes from `@/injector/config`. Import it the way `syncGate` does; it is a plain constant, so a static import is fine.

- [ ] **Step 4: Run the tests and typecheck.** `npx vitest run src/test/guards src/components/CampusMap src/api src/store src/services/spolky src/components/AdminConsole src/hooks && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: UI verification (`verify-ui` skill).**
  - Seed `dev:web` (the in-memory society store) with:
    - one `tba` event 3 days out
    - one `tba` multi-day event 40 days out
    - one normal pinned event
    - a society with `instagram` set
  - Capture at 320, 390 and 430 px, plus the iPad width on the phone tree, and the desktop side panel:
    - the list with "Později (1)" collapsed, then expanded
    - the TBA card with "Více na Instagramu"
    - the composer publishing with only a title and a date
    - the console row with "Bez místa" and "Zájem v reIS"
  - Run its overflow, collision and contrast assertions in both themes.
  - Send the before/after PNGs to Dominik with SendUserFile before calling this done.

- [ ] **Step 6: Commit**

```bash
git add capacitor/startApp.ts src/test/guards/eventsResumeRefreshIsCapacitorOnly.test.ts
git commit -m "feat(events): refresh events on app resume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Delete the old window exports; open the PR

**Files:**
- Modify: `src/components/CampusMap/eventWindow.ts`, `src/components/CampusMap/__tests__/eventWindow.test.ts`

- [ ] **Step 1: Confirm no caller is left.** Include tests in the search:

```bash
grep -rn "isPublicEvent\|isScheduledEvent\|goLiveDate\|PUBLIC_WINDOW_DAYS" src capacitor
```

Expected: only `eventWindow.ts` and the old cases in `eventWindow.test.ts`. Any other hit belongs to the task that owns that file; fix it there first.

- [ ] **Step 2: Delete** `PUBLIC_WINDOW_DAYS`, `isPublicEvent`, `isScheduledEvent` and `goLiveDate` from `eventWindow.ts`, along with their test cases. Rewrite the file's top comment: "the soon horizon (pins, Novinky) is SOON_WINDOW_DAYS; the catalog list has no upper bound".

- [ ] **Step 3: Run and typecheck.** `npx vitest run src/components/CampusMap src/api src/services/spolky src/components/AdminConsole && npm run typecheck`. Expected: PASS.

- [ ] **Step 4: Commit and open the PR**

```bash
git add src/components/CampusMap/eventWindow.ts src/components/CampusMap/__tests__/eventWindow.test.ts
git commit -m "refactor(events): drop the 14-day public window helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u personal HEAD
gh pr create --base test --title "feat(events): whole-semester catalog, place-TBA, Instagram link" --body "Phase 2 of docs/superpowers/specs/2026-09-28-society-events-catalog-design.md. Both trees (shared CampusMap/AdminConsole/Novinky); resume refresh is Capacitor-only by design (guard added).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then turn on Auto-fix and bind the PR with the ccd_pr tools.
