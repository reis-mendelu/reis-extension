# Calendar view choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The phone calendar asks once "Den nebo Týden?" (try both live, then Uložit), the floating view switch is removed, and the choice lives in a new Nastavení sheet reached from one Profile row.

**Architecture:** The single persisted `mobileCalendarView` splits into an in-memory *shown* view (driven by the chooser, a week-view day peek, and resets) and a persisted *saved* view plus a tri-state `calendarViewChosen` flag (`null` not hydrated / `false` never saved / `true` saved), following the `welcomeSeen` / `pullHintSeen` pattern. A `CalendarViewChooser` panel renders in the calendar's day and week branches while `calendarViewChosen === false`. Profile's Vzhled + Nastavení groups collapse into one NavRow opening a `settings` sheet.

**Tech Stack:** React 19, Zustand slices, DaisyUI 5 / Tailwind v4, sonner (shared wrapper), vitest + Testing Library, Capacitor.

**Spec:** `docs/superpowers/specs/2026-10-09-calendar-view-choice-design.md`

## Global Constraints

- Phone/iPad tree only. The extension (desktop tree) does not change; pinned by a guard (Task 5).
- Persistence through `IndexedDBService` `meta` key `calendar_view` only — never localStorage (Iron Rules).
- No custom CSS: DaisyUI semantic classes and Tailwind utilities only.
- Copy, verbatim from the spec:
  - Panel title: cs "Jak chceš vidět rozvrh?" / en "How do you want to see your timetable?"
  - Panel line: cs "Zkus obojí na svém rozvrhu." / en "Try both on your own timetable."
  - Button: cs "Uložit: Den" / "Uložit: Týden"; en "Save: Day" / "Save: Week"
  - Toast: cs "Uloženo. Změníš to v Profilu → Nastavení." / en "Saved. Change it in Profile → Settings."
  - Profile row + sheet title: cs "Nastavení" / en "Settings"
  - Sheet row: cs "Kalendář" / en "Calendar"
  - Group: cs "Ve škole" / en "At school"
- Nothing is persisted until Uložit (chooser) or a tap in the Nastavení sheet. A week-view day tap never persists.
- Demo mode counts as chosen. Not hydrated (`null`) never shows the chooser.
- The chooser never renders over the skeleton or the error state.
- Write nuia-clean code (no unchecked index access); files ≤ 200 lines where practical.
- Per task, run locally: the tests you touched (`npx vitest run <pattern>`) and `npm run typecheck`. Leave lint/format/full suite to CI. Under load use `--no-file-parallelism --maxWorkers=1`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Store — saved vs shown calendar view

**Files:**
- Modify: `src/store/types.ts` (the `MobileUiSlice` calendar fields, ~lines 549-552)
- Modify: `src/store/slices/createMobileUiSlice.ts` (initial state ~line 36, `hydrateCalendarView`/`setMobileCalendarView` ~lines 75-86)
- Modify: `capacitor/startApp.ts:85-89`
- Modify: `src/mobile/calendarResume.ts`
- Test: `src/store/slices/__tests__/createMobileUiSlice.calendarView.test.ts` (rewrite)
- Test: `src/mobile/__tests__/calendarResume.test.ts`

**Interfaces:**
- Produces (on `MobileUiSlice`, used by Tasks 2–4):
  - `mobileCalendarView: MobileCalendarView` — what the calendar shows (in memory)
  - `savedCalendarView: MobileCalendarView` — the saved choice, `'day'` until one is saved
  - `calendarViewChosen: boolean | null`
  - `hydrateCalendarView: (o: { demo: boolean }) => Promise<void>`
  - `showCalendarView: (view: MobileCalendarView) => void` — shown only, no write
  - `saveCalendarView: (view: MobileCalendarView) => void` — saved + shown + chosen, writes `meta.calendar_view`
  - `restoreCalendarView: () => void` — shown ← saved
- Removes: `setMobileCalendarView` (its two callers are fixed in Task 2; `CalendarViewSwitch` is deleted there).

- [ ] **Step 1: Rewrite the slice test**

Replace the whole body of `src/store/slices/__tests__/createMobileUiSlice.calendarView.test.ts` from the `describe` down (keep imports and the `vi.mock`) with:

```ts
/**
 * The calendar's day/week choice is asked once and then saved on the device
 * (spec 2026-10-09). What the calendar SHOWS is separate from what is SAVED:
 * trying a view in the chooser, or peeking at one day from the week, must not
 * overwrite the choice. IndexedDB, never localStorage (Iron Rules).
 */
describe('createMobileUiSlice — calendar view', () => {
  let state: MobileUiSlice;
  let set: Mock & Parameters<typeof createMobileUiSlice>[0];
  let get: Mock & Parameters<typeof createMobileUiSlice>[1];

  beforeEach(() => {
    vi.mocked(IndexedDBService.get).mockReset();
    vi.mocked(IndexedDBService.set).mockClear();
    set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state) as unknown as typeof get;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createMobileUiSlice(set, get, {} as any);
  });

  it('opens on the day view, not yet hydrated', () => {
    expect(state.mobileCalendarView).toBe('day');
    expect(state.savedCalendarView).toBe('day');
    expect(state.calendarViewChosen).toBeNull();
  });

  it('hydrates a saved week as chosen', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('week');
    await state.hydrateCalendarView({ demo: false });
    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'calendar_view');
    expect(state.calendarViewChosen).toBe(true);
    expect(state.savedCalendarView).toBe('week');
    expect(state.mobileCalendarView).toBe('week');
  });

  it('a missing key means the student never chose', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateCalendarView({ demo: false });
    expect(state.calendarViewChosen).toBe(false);
    expect(state.mobileCalendarView).toBe('day');
  });

  it('an unknown stored value is asked again rather than trusted', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('month');
    await state.hydrateCalendarView({ demo: false });
    expect(state.calendarViewChosen).toBe(false);
  });

  it('demo mode counts as chosen and reads nothing', async () => {
    await state.hydrateCalendarView({ demo: true });
    expect(state.calendarViewChosen).toBe(true);
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('showing a view changes the screen and writes nothing', () => {
    state.showCalendarView('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(state.savedCalendarView).toBe('day');
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });

  it('saving writes the choice and marks it chosen', () => {
    state.saveCalendarView('week');
    expect(state.savedCalendarView).toBe('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(state.calendarViewChosen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'calendar_view', 'week');
  });

  it('restoring puts the saved view back after a peek', () => {
    state.saveCalendarView('week');
    state.showCalendarView('day');
    state.restoreCalendarView();
    expect(state.mobileCalendarView).toBe('week');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run createMobileUiSlice.calendarView`
Expected: FAIL — `savedCalendarView` undefined, `showCalendarView is not a function`.

- [ ] **Step 3: Update the types**

In `src/store/types.ts`, replace

```ts
  /** The calendar's day agenda or week grid, remembered per device. */
  mobileCalendarView: MobileCalendarView;
  setMobileCalendarView: (view: MobileCalendarView) => void;
  hydrateCalendarView: () => Promise<void>;
```

with

```ts
  /**
   * What the calendar SHOWS: the saved view, a view being tried in the chooser,
   * or one day peeked at from the week. In memory only.
   */
  mobileCalendarView: MobileCalendarView;
  /** The student's saved choice, `meta.calendar_view`. 'day' until one is saved. */
  savedCalendarView: MobileCalendarView;
  /**
   * Whether a view has been saved. null = not hydrated yet (never show the
   * chooser); false = never saved (show it); true = saved.
   */
  calendarViewChosen: boolean | null;
  hydrateCalendarView: (o: { demo: boolean }) => Promise<void>;
  showCalendarView: (view: MobileCalendarView) => void;
  saveCalendarView: (view: MobileCalendarView) => void;
  restoreCalendarView: () => void;
```

- [ ] **Step 4: Implement in the slice**

In `createMobileUiSlice.ts`, replace the initial `mobileCalendarView: 'day',` line with:

```ts
  mobileCalendarView: 'day',
  savedCalendarView: 'day',
  calendarViewChosen: null,
```

Replace the `hydrateCalendarView` and `setMobileCalendarView` block (comments included) with:

```ts
  // Read once at boot beside the pull hint. Only 'day' or 'week' counts as a
  // choice; a missing key — or a value from some other build — asks again.
  // Demo mode counts as chosen, like the pull hint: the reviewer's calendar
  // should open on the timetable, not on a question.
  hydrateCalendarView: async ({ demo }) => {
    if (demo) {
      set({ calendarViewChosen: true });
      return;
    }
    const stored = await IndexedDBService.get('meta', 'calendar_view');
    if (stored === 'day' || stored === 'week') {
      set({ savedCalendarView: stored, mobileCalendarView: stored, calendarViewChosen: true });
      return;
    }
    set({ calendarViewChosen: false });
  },
  // Trying a view in the chooser, or peeking at one day from the week: the
  // screen changes, the choice does not.
  showCalendarView: (view) => set({ mobileCalendarView: view }),
  // State first, storage second, like dismissWelcome: the view changes on the
  // tap, and a failed write only means the choice is not remembered.
  saveCalendarView: (view) => {
    set({ savedCalendarView: view, mobileCalendarView: view, calendarViewChosen: true });
    IndexedDBService.set('meta', 'calendar_view', view).catch(() => {});
  },
  restoreCalendarView: () => set({ mobileCalendarView: get().savedCalendarView }),
```

- [ ] **Step 5: Pass `demo` at boot**

In `capacitor/startApp.ts`, change

```ts
  // And the calendar's day/week choice, so its first frame is the view the
  // student left it on rather than the day view swapping to the week a tick in.
  await useAppStore
    .getState()
    .hydrateCalendarView()
    .catch(() => {});
```

to

```ts
  // And the calendar's day/week choice, so its first frame is the saved view
  // rather than the day view swapping to the week a tick in — or, when nothing
  // is saved, already knows to offer the chooser.
  await useAppStore
    .getState()
    .hydrateCalendarView({ demo })
    .catch(() => {});
```

- [ ] **Step 6: Update the resume test**

In `src/mobile/__tests__/calendarResume.test.ts`, replace the `setState` call and the last assertion:

```ts
    useAppStore.setState({
      mobileSelectedDayIso: '2026-11-12',
      // A day peeked at from the week, left open overnight.
      mobileCalendarView: 'day',
      savedCalendarView: 'week',
      now: lastNight,
    });
```

and

```ts
    // The saved view comes back — a peek at one day was not a choice.
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
```

- [ ] **Step 7: Restore the saved view on resume**

In `src/mobile/calendarResume.ts`, change the doc sentence "The day/week view is the student's standing choice and is left alone, as Google leaves it." to "The SAVED day/week view comes back too: a day peeked at from the week is not a choice, and Google likewise reopens in the view the student keeps." and add after `setMobileSelectedDay(null);`:

```ts
    useAppStore.getState().restoreCalendarView();
```

- [ ] **Step 8: Keep the two old callers compiling**

`setMobileCalendarView` is gone; until Task 2 removes the switch, point its two
callers at `saveCalendarView` (same behaviour they had: show + persist):
- `src/components/mobile/screens/calendar/CalendarViewSwitch.tsx`: `s.setMobileCalendarView` → `s.saveCalendarView`.
- `src/components/mobile/screens/CalendarScreen.tsx:37`: `s.setMobileCalendarView` → `s.saveCalendarView`.

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run createMobileUiSlice.calendarView calendarResume CalendarScreen.week`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/store/types.ts src/store/slices/createMobileUiSlice.ts capacitor/startApp.ts src/mobile/calendarResume.ts src/components/mobile/screens/calendar/CalendarViewSwitch.tsx src/components/mobile/screens/CalendarScreen.tsx src/store/slices/__tests__/createMobileUiSlice.calendarView.test.ts src/mobile/__tests__/calendarResume.test.ts
git commit -m "feat(calendar): separate the saved view from the shown one

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Calendar — remove the switch, make a week-day tap a peek

**Files:**
- Delete: `src/components/mobile/screens/calendar/CalendarViewSwitch.tsx`
- Modify: `src/components/mobile/screens/CalendarScreen.tsx` (imports, `view`/`setView` ~lines 36-37, `shell` ~lines 107-122, error pad ~line 152, `onPickDay` ~lines 207-211)
- Modify: `src/components/mobile/screens/calendar/DayBody.tsx:129`
- Modify: `src/components/mobile/screens/calendar/WeekGrid.tsx:33-34,83`
- Modify: `src/components/mobile/nav/BottomNav.tsx:33-67`
- Modify: `src/test/guards/weekViewHasBothTrees.test.ts:26`
- Test: `src/components/mobile/screens/__tests__/CalendarScreen.week.test.tsx`
- Test: `src/components/mobile/nav/__tests__/BottomNav.retap.test.tsx`

**Interfaces:**
- Consumes: `showCalendarView`, `restoreCalendarView`, `savedCalendarView` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Update the week-view tests**

In `CalendarScreen.week.test.tsx`:

Add `savedCalendarView: 'day', calendarViewChosen: true,` to the `beforeEach` `setState` object next to `mobileCalendarView: 'day',`.

Replace the test `'the switch turns the day agenda into the week grid'` with:

```ts
  // Spec 2026-10-09: the view is chosen once and changed in Profile →
  // Nastavení, so the calendar carries no switch in either view.
  it('has no view switch on the calendar', () => {
    render(<CalendarScreen />);
    expect(screen.queryByRole('group', { name: 'Zobrazení kalendáře' })).toBeNull();
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    expect(screen.queryByRole('group', { name: 'Zobrazení kalendáře' })).toBeNull();
  });
```

Replace the test `'tapping a day in the strip opens that day'` with:

```ts
  // A peek, not a choice: with no switch on screen, saving 'day' here would
  // strand a Týden student in the day view until they found Profile.
  it('tapping a day in the strip opens that day without changing the saved view', () => {
    useAppStore.setState({ mobileCalendarView: 'week', savedCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    fireEvent.click(within(screen.getByTestId('day-strip')).getByRole('button', { name: /Út 6/ }));
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
    expect(useAppStore.getState().savedCalendarView).toBe('week');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-06');
  });
```

- [ ] **Step 2: Add the re-tap test**

In `BottomNav.retap.test.tsx`, add inside the `describe`:

```ts
  // After a peek at one day from the week, the tab that takes you home takes
  // you back to the view you saved, too.
  it('returns to the saved view', () => {
    useAppStore.setState({ mobileCalendarView: 'day', savedCalendarView: 'week' } as never);
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendář' }));
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run CalendarScreen.week BottomNav.retap`
Expected: FAIL — the switch group is found; the peek writes `'day'`; the re-tap leaves `'day'`.

- [ ] **Step 4: Remove the switch from `CalendarScreen`**

- Delete the import line `import { CalendarViewSwitch } from './calendar/CalendarViewSwitch';`.
- Replace `const setView = useAppStore((s) => s.saveCalendarView);` (Task 1, Step 8) with `const showView = useAppStore((s) => s.showCalendarView);`.
- In the `chrome` comment, change "a floating "Dnes" pill beside the view switch read as one confusing row of words" to "a floating "Dnes" pill read as one more control at the bottom of the screen".
- Replace the `shell` definition with:

```tsx
  const shell = (body: ReactNode) => (
    // `relative` anchors the first-open view chooser (day and week only). The
    // ref is where a pull to refresh may start (DayBody).
    <div
      ref={screenRef}
      data-testid="calendar-screen"
      className="relative flex flex-1 flex-col overflow-hidden"
    >
      {chrome}
      {body}
    </div>
  );
```

- In the error branch, change `pb-[calc(9rem_+_var(--safe-bottom,0px))]` to `pb-[calc(6rem_+_var(--safe-bottom,0px))]`.
- Replace the `onPickDay` prop with:

```tsx
          // A chip in the week view zooms in on that day — a peek, not a
          // choice. The saved view comes back on a Kalendář re-tap or a reopen.
          onPickDay={(iso) => {
            setMobileSelectedDay(iso);
            showView('day');
          }}
```

- [ ] **Step 5: Give the bottom band back**

The tab bar needs 76px of clearance (measured in `ProfileScreen.tsx`'s comment); 6rem = 96px leaves the 20px breathing room the agenda had before #313.

- `DayBody.tsx:129`: `pb-[calc(9rem_+_var(--safe-bottom,0px))]` → `pb-[calc(6rem_+_var(--safe-bottom,0px))]`.
- `WeekGrid.tsx:83`: `pb-[calc(8.5rem_+_var(--safe-bottom,0px))]` → `pb-[calc(6rem_+_var(--safe-bottom,0px))]`.
- `WeekGrid.tsx` doc comment: replace "The bottom padding reserves the band the view switch floats in." with "The bottom padding clears the tab bar."

- [ ] **Step 6: Delete the switch and update the guard list**

```bash
git rm src/components/mobile/screens/calendar/CalendarViewSwitch.tsx
```

In `src/test/guards/weekViewHasBothTrees.test.ts`, delete the line `'components/mobile/screens/calendar/CalendarViewSwitch.tsx',`.

- [ ] **Step 7: Restore the saved view on a Kalendář re-tap**

In `BottomNav.tsx`, after `const { goToday } = useCalendarToday();` add:

```ts
  const restoreCalendarView = useAppStore((s) => s.restoreCalendarView);
```

and change the click handler body to:

```ts
            onClick={() => {
              setMobileTab(id);
              if (active && id === 'calendar') {
                goToday();
                // Home is today in the saved view: a day peeked at from the
                // week goes back to the week.
                restoreCalendarView();
              }
            }}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run CalendarScreen BottomNav weekViewHasBothTrees`
Expected: PASS (all CalendarScreen.* files — `CalendarScreen.today.test.tsx` sets `mobileCalendarView: 'day'` only, which still type-checks via `as never`).
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A src/components/mobile src/test/guards/weekViewHasBothTrees.test.ts
git commit -m "feat(calendar): no view switch on the calendar; a week-day tap is a peek

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The first-open chooser

**Files:**
- Create: `src/components/mobile/screens/calendar/CalendarViewChooser.tsx`
- Create: `src/components/mobile/screens/calendar/calendarBottomPad.ts`
- Modify: `src/components/mobile/screens/CalendarScreen.tsx` (week and day branches)
- Modify: `src/components/mobile/screens/calendar/DayBody.tsx:129`
- Modify: `src/components/mobile/screens/calendar/WeekGrid.tsx:83`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (`mobile.calendar`, after `"weekView"`)
- Test: `src/components/mobile/screens/__tests__/CalendarScreen.chooser.test.tsx`

**Interfaces:**
- Consumes: `calendarViewChosen`, `mobileCalendarView`, `showCalendarView`, `saveCalendarView` (Task 1).
- Produces: `CalendarViewChooser` (no props); `useCalendarBottomPad(): string`.

- [ ] **Step 1: Add the copy**

`cs.json`, in `mobile.calendar`, after `"weekView": "Týden"` (add the comma):

```json
      "chooserTitle": "Jak chceš vidět rozvrh?",
      "chooserLine": "Zkus obojí na svém rozvrhu.",
      "chooserSave": "Uložit: {view}",
      "chooserSaved": "Uloženo. Změníš to v Profilu → Nastavení."
```

`en.json`, same place:

```json
      "chooserTitle": "How do you want to see your timetable?",
      "chooserLine": "Try both on your own timetable.",
      "chooserSave": "Save: {view}",
      "chooserSaved": "Saved. Change it in Profile → Settings."
```

- [ ] **Step 2: Write the failing test**

Create `src/components/mobile/screens/__tests__/CalendarScreen.chooser.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

/**
 * Spec 2026-10-09: a student who never saved a view is asked once, on their
 * own timetable. Den | Týden swaps the calendar live; nothing is saved until
 * "Uložit"; leaving without saving asks again next time.
 */
describe('CalendarScreen — first-open view chooser', () => {
  const lesson = {
    courseId: '',
    roomStructured: { name: '', id: '' },
    teachers: [],
    periodId: '',
    studyId: '',
    campus: '',
    isDefaultCampus: 'true',
    facultyCode: '',
    isSeminar: 'false',
    isConsultation: 'false',
    id: 'pj',
    date: '20261007',
    startTime: '15:00',
    endTime: '16:50',
    courseName: 'Programovací jazyk Java',
    courseCode: 'EBC-PJ',
    room: 'Q07',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
    vi.mocked(toast).mockClear();
    useAppStore.setState({
      now: new Date('2026-10-07T10:00:00'),
      language: 'cz',
      mobileSelectedDayIso: '2026-10-07',
      mobileSheets: [],
      mobileTab: 'calendar',
      mobileCalendarView: 'day',
      savedCalendarView: 'day',
      calendarViewChosen: false,
      schedule: { data: [lesson], status: 'success' },
      customEvents: [],
      hiddenItems: { courses: [], events: [] },
      teachingWeekData: null,
      firstSyncSettled: true,
      syncLoaded: { schedule: true },
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  const chooser = () => screen.queryByTestId('calendar-view-chooser');

  it('asks a student who never saved a view', () => {
    render(<CalendarScreen />);
    expect(chooser()).not.toBeNull();
    expect(screen.getByText('Jak chceš vidět rozvrh?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uložit: Den' })).toBeTruthy();
  });

  it('does not ask before the choice has hydrated', () => {
    useAppStore.setState({ calendarViewChosen: null } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('does not ask once a view is saved', () => {
    useAppStore.setState({ calendarViewChosen: true } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('does not ask over the skeleton', () => {
    useAppStore.setState({
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: false,
        handshakeTimedOut: false,
      },
    } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('trying Týden swaps in the week grid and saves nothing', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(screen.getByTestId('week-grid')).toBeTruthy();
    expect(useAppStore.getState().savedCalendarView).toBe('day');
    expect(useAppStore.getState().calendarViewChosen).toBe(false);
    expect(screen.getByRole('button', { name: 'Uložit: Týden' })).toBeTruthy();
  });

  it('Uložit saves the view, closes the chooser and says where it lives now', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit: Týden' }));
    expect(useAppStore.getState().savedCalendarView).toBe('week');
    expect(useAppStore.getState().calendarViewChosen).toBe(true);
    expect(chooser()).toBeNull();
    expect(toast).toHaveBeenCalledWith('Uloženo. Změníš to v Profilu → Nastavení.');
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run CalendarScreen.chooser`
Expected: FAIL — `calendar-view-chooser` not found.

- [ ] **Step 4: Create the bottom-pad hook**

Create `src/components/mobile/screens/calendar/calendarBottomPad.ts`:

```ts
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The bottom padding of the agenda and the week grid. It clears the tab bar
 * (76px measured, +20) — and, while the first-open view chooser is up, the
 * chooser's band as well. The week grid never scrolls, so this is what makes
 * it compress to fit ABOVE the chooser instead of drawing its afternoon under
 * it while the student compares. Full literal class strings, so Tailwind's
 * scanner sees both.
 */
const NAV_PAD = 'pb-[calc(6rem_+_var(--safe-bottom,0px))]';
const CHOOSER_PAD = 'pb-[calc(16rem_+_var(--safe-bottom,0px))]';

export function useCalendarBottomPad(): string {
  const choosing = useAppStore((s) => s.calendarViewChosen === false);
  return choosing ? CHOOSER_PAD : NAV_PAD;
}
```

Use it:
- `DayBody.tsx`: import `useCalendarBottomPad` from `./calendarBottomPad`, call `const bottomPad = useCalendarBottomPad();` at the top of the component, and change `<AlwaysScrollable className="pb-[calc(6rem_+_var(--safe-bottom,0px))]">` to `<AlwaysScrollable className={bottomPad}>`.
- `WeekGrid.tsx`: same import and call; change the `className` to the template string
  ``className={`flex min-h-0 flex-1 touch-none gap-1 px-2 ${bottomPad} pt-2 transition-transform duration-200 ease-out`}``.

16rem is an estimate (chooser ≈160px tall, standing 84px above the bottom). Task 6 measures it; adjust `CHOOSER_PAD` there if the chooser's top is not cleared.

- [ ] **Step 5: Create the chooser**

Create `src/components/mobile/screens/calendar/CalendarViewChooser.tsx`:

```tsx
import { toast } from 'sonner';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Asked once (spec 2026-10-09): Den or Týden, tried live on the student's own
 * timetable above it, saved only by the button that names what it saves.
 *
 * It stands where the view switch used to float, above the tab bar, and only
 * over the real day and week views — never the skeleton or the error state.
 * The toast after saving says where the choice lives now, because the
 * calendar itself no longer carries a switch.
 *
 * The segments are tonal like BottomNav's active tab (--tone-primary on the
 * /15 tint), so the one solid lime control is the save button.
 */
export function CalendarViewChooser() {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.mobileCalendarView);
  const show = useAppStore((s) => s.showCalendarView);
  const save = useAppStore((s) => s.saveCalendarView);

  const label = (v: MobileCalendarView) =>
    t(v === 'day' ? 'mobile.calendar.dayView' : 'mobile.calendar.weekView');

  const option = (v: MobileCalendarView) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => show(v)}
      className={`join-item btn btn-ghost btn-sm flex-1 ${
        view === v ? 'bg-primary/15 text-[var(--tone-primary)]' : 'text-base-content/70'
      }`}
    >
      {label(v)}
    </button>
  );

  return (
    <section
      data-testid="calendar-view-chooser"
      aria-label={t('mobile.calendar.chooserTitle')}
      className="absolute bottom-[calc(84px_+_var(--safe-bottom,0px))] left-1/2 z-30 w-[calc(100%-20px)] max-w-sm -translate-x-1/2 rounded-3xl border border-base-300 bg-base-100 p-3 shadow-drawer"
    >
      <h2 className="text-md font-bold">{t('mobile.calendar.chooserTitle')}</h2>
      <p className="mt-0.5 text-sm text-base-content/70">{t('mobile.calendar.chooserLine')}</p>
      <div
        role="group"
        aria-label={t('mobile.calendar.viewLabel')}
        className="join mt-2.5 flex w-full rounded-full border border-base-300 bg-base-200 p-0.5"
      >
        {option('day')}
        {option('week')}
      </div>
      <button
        type="button"
        onClick={() => {
          save(view);
          toast(t('mobile.calendar.chooserSaved'));
        }}
        className="btn btn-primary btn-block mt-2.5 rounded-full"
      >
        {t('mobile.calendar.chooserSave', { view: label(view) })}
      </button>
    </section>
  );
}
```

- [ ] **Step 6: Mount it in the day and week branches**

In `CalendarScreen.tsx`:
- Import: `import { CalendarViewChooser } from './calendar/CalendarViewChooser';`
- Next to `showView`: `const choosing = useAppStore((s) => s.calendarViewChosen === false);`
- In the week branch, after `<WeekGrid … />` and before `</>`: `{choosing && <CalendarViewChooser />}`
- In the day branch, after `<DayBody … />` and before `</>`: `{choosing && <CalendarViewChooser />}`

The Task 2 test `'has no view switch on the calendar'` sets `calendarViewChosen: true`, so it does not see the chooser's group.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run CalendarScreen DayBody WeekGrid`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/mobile/screens src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(calendar): ask Den or Týden once, on the student's own timetable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Profile → one Nastavení row and its sheet

**Files:**
- Create: `src/components/mobile/screens/profile/CalendarViewRow.tsx`
- Create: `src/components/mobile/sheets/SettingsSheet.tsx`
- Modify: `src/store/types.ts` (`MobileSheet` union, after `| { kind: 'docs' }`)
- Modify: `src/components/mobile/sheets/SheetHost.tsx`
- Modify: `src/components/mobile/screens/ProfileScreen.tsx`
- Modify: `src/components/mobile/screens/profile/AppearanceRows.tsx` (doc comment only)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (`mobile.profile`)
- Test: `src/components/mobile/sheets/__tests__/SettingsSheet.test.tsx` (create)
- Test: `src/components/mobile/screens/__tests__/ProfileScreenSettings.test.tsx`
- Test: `src/components/mobile/screens/__tests__/ProfileScreen.test.tsx:87-94`

**Interfaces:**
- Consumes: `savedCalendarView`, `saveCalendarView` (Task 1).
- Produces: `MobileSheet` kind `'settings'`; `SettingsSheet({ onClose })`; `CalendarViewRow` (no props).

- [ ] **Step 1: Profile copy**

`cs.json` `mobile.profile` becomes:

```json
    "profile": {
      "settings": "Nastavení",
      "atSchool": "Ve škole",
      "calendar": "Kalendář",
      "themeDark": "Tmavý",
      "themeLight": "Světlý"
    },
```

`en.json`:

```json
    "profile": {
      "settings": "Settings",
      "atSchool": "At school",
      "calendar": "Calendar",
      "themeDark": "Dark",
      "themeLight": "Light"
    },
```

(`appearance` is removed; its only reader is the ProfileScreen line replaced in Step 6. Confirm with `grep -rn "profile.appearance" src` → no hits after Step 6.)

- [ ] **Step 2: Write the sheet test**

Create `src/components/mobile/sheets/__tests__/SettingsSheet.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsSheet } from '../SettingsSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Nastavení (spec 2026-10-09): the three things a student sets once —
 * calendar view, language, dark mode — behind one Profile row.
 */
describe('SettingsSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      isThemeLoading: false,
      mobileCalendarView: 'day',
      savedCalendarView: 'day',
      calendarViewChosen: true,
    } as never);
  });

  it('saves the calendar view', () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(useAppStore.getState().savedCalendarView).toBe('week');
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });

  it('saving here also answers the first-open chooser', () => {
    useAppStore.setState({ calendarViewChosen: false } as never);
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(useAppStore.getState().calendarViewChosen).toBe(true);
  });

  it('flips the theme between mendelu-dark and mendelu', async () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    const themeToggle = screen.getByRole('checkbox', { name: /Tmavý režim/i });
    expect(themeToggle).toBeChecked();
    fireEvent.click(themeToggle);
    await waitFor(() => expect(useAppStore.getState().theme).toBe('mendelu'));
  });

  it('switches the language', async () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('English'));
    await waitFor(() => expect(useAppStore.getState().language).toBe('en'));
  });
});
```

- [ ] **Step 3: Update the Profile tests**

In `ProfileScreenSettings.test.tsx`, inside `describe('ProfileScreen', …)`:
- Delete `'flips the theme between mendelu-dark and mendelu'` and `'switches the language'` (moved to the sheet test).
- Replace `'shows a hidden event and restores it, removing it from the hidden list'` with:

```tsx
  // Hiding lessons exists only on desktop calendar cards, and storage is per
  // device, so on a phone this list was always empty and never rendered.
  it('has no hidden-items list on the phone', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('Skryté položky')).toBeNull();
  });

  it('opens Nastavení in one tap, showing the current values', () => {
    useAppStore.setState({ savedCalendarView: 'week' } as never);
    render(<ProfileScreen />);
    expect(screen.getByText('Týden · Čeština · Tmavý')).toBeTruthy();
    fireEvent.click(screen.getByText('Nastavení'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'settings' }]);
  });

  it('groups eduroam and documents under Ve škole, with no Vzhled group', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Ve škole')).toBeTruthy();
    expect(screen.queryByText('Vzhled')).toBeNull();
  });
```

In `ProfileScreen.test.tsx`, the test `'renders as a screen, with the settings that were in the sheet'` (~line 87): replace its `expect(screen.getByText('Tmavý režim'))…` assertion with `expect(screen.getByText('Nastavení')).toBeInTheDocument();` and rename it `'renders as a screen, with a way into Nastavení'`. Read the full test first and keep its other assertions.

- [ ] **Step 4: Run them to see them fail**

Run: `npx vitest run SettingsSheet ProfileScreen`
Expected: FAIL — `SettingsSheet` module missing; no "Nastavení" row text with values; "Skryté položky" … (it renders null with empty data, so that one may already pass — fine).

- [ ] **Step 5: Create the row and the sheet; register the kind**

`src/store/types.ts`, in the `MobileSheet` union after `| { kind: 'docs' }`:

```ts
  // Calendar view, language, dark mode — behind one Profile row (spec 2026-10-09).
  | { kind: 'settings' }
```

Create `src/components/mobile/screens/profile/CalendarViewRow.tsx`:

```tsx
import { CalendarDays } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Den | Týden in Nastavení — the one place the calendar view changes after the
 * first-open chooser. Same "label left, options right" join as the language
 * row in AppearanceRows. Writes the SAVED view directly.
 */
export function CalendarViewRow() {
  const { t } = useTranslation();
  const saved = useAppStore((s) => s.savedCalendarView);
  const save = useAppStore((s) => s.saveCalendarView);

  const option = (v: MobileCalendarView, label: string) => (
    <button
      type="button"
      aria-pressed={saved === v}
      onClick={() => save(v)}
      className={`join-item btn btn-xs ${saved === v ? 'btn-primary' : 'btn-ghost opacity-60'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <CalendarDays size={16} className="flex-shrink-0 text-base-content/50" />
      <span className="flex-1 text-md font-medium">{t('mobile.profile.calendar')}</span>
      <div className="join">
        {option('day', t('mobile.calendar.dayView'))}
        {option('week', t('mobile.calendar.weekView'))}
      </div>
    </div>
  );
}
```

Create `src/components/mobile/sheets/SettingsSheet.tsx`:

```tsx
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { CalendarViewRow } from '../screens/profile/CalendarViewRow';
import { AppearanceRows } from '../screens/profile/AppearanceRows';

export interface SettingsSheetProps {
  onClose: () => void;
}

/**
 * Nastavení: what a student sets once and rarely revisits (spec 2026-10-09).
 * One row on Profile opens it, so Profile itself stays a short list of things
 * to DO — and has room to.
 */
export function SettingsSheet({ onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.profile.settings')} onClose={onClose} />
      <div className="pb-6">
        <CalendarViewRow />
        <AppearanceRows />
      </div>
    </Sheet>
  );
}
```

`SheetHost.tsx`: add `import { SettingsSheet } from './SettingsSheet';` and, after the `docs` case:

```tsx
          case 'settings':
            return <SettingsSheet key={index} onClose={popSheet} />;
```

`AppearanceRows.tsx` doc comment: "Dark mode and language — the two rows under VZHLED." → "Dark mode and language, in the Nastavení sheet under the calendar view."

- [ ] **Step 6: Regroup `ProfileScreen`**

- Imports: remove `HiddenItemsSection` and `AppearanceRows`; add `Settings` to the lucide import; add `import { useTheme } from '../../../hooks/useTheme';`.
- After `const loadImpersonationOptions = …` add:

```tsx
  // The Nastavení row says what is set, so a student can check without opening it.
  const savedView = useAppStore((s) => s.savedCalendarView);
  const language = useAppStore((s) => s.language);
  const { isDark } = useTheme();
  const settingsSummary = [
    t(savedView === 'week' ? 'mobile.calendar.weekView' : 'mobile.calendar.dayView'),
    t(language === 'en' ? 'settings.english' : 'settings.czech'),
    t(isDark ? 'mobile.profile.themeDark' : 'mobile.profile.themeLight'),
  ].join(' · ');
```

- Replace everything from the `{t('mobile.profile.appearance')}` header div through the `{t('mobile.profile.settings')}` header div (inclusive — i.e. the Vzhled header, `<AppearanceRows />`, and the Nastavení header) with:

```tsx
          {/* One row, not a group: calendar view, language and dark mode are set
            once (spec 2026-10-09), so they sit one tap down and the screen
            keeps its room for things a student comes here to do. */}
          <div className="pt-2">
            <NavRow
              icon={Settings}
              label={t('mobile.profile.settings')}
              sublabel={settingsSummary}
              onClick={() => pushSheet({ kind: 'settings' })}
            />
          </div>

          <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.profile.atSchool')}
          </div>
```

- Delete `<HiddenItemsSection />` and update the component doc comment: drop "hidden items" from the list and replace the paragraph about `HiddenItemsSection` with: "No hidden-items list: hiding exists only on desktop calendar cards and storage is per device, so on a phone it was always empty (spec 2026-10-09)."

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run SettingsSheet ProfileScreen SheetHost`
Expected: PASS.
Run: `grep -rn "profile.appearance" src` → no output.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/store/types.ts src/components/mobile src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(profile): one Nastavení row; calendar view, language and theme in its sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pin the phone-only decision

**Files:**
- Create: `src/test/guards/calendarViewChoiceIsPhoneOnly.test.ts`

- [ ] **Step 1: Write the guard**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The calendar view chooser and the Nastavení sheet are PHONE/iPAD ONLY, on
 * purpose (spec 2026-10-09).
 *
 * The extension's calendar is always the week (`weekViewHasBothTrees`), so
 * there is no view to choose, and its Profile popover already shows language
 * and dark mode inline with room to spare. The phone moved those behind one
 * row because a phone screen must fit without scrolling. A later "let's reuse
 * the sheet on desktop" would add a choice the desktop cannot act on.
 *
 * Both halves are pinned: the phone files exist and are wired; the desktop
 * neither imports them nor grows a view choice.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/screens/calendar/CalendarViewChooser.tsx',
  'components/mobile/screens/calendar/calendarBottomPad.ts',
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/calendar/WeekGrid.tsx',
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/screens/ProfileScreen.tsx',
  'components/mobile/screens/profile/CalendarViewRow.tsx',
  'components/mobile/screens/profile/AppearanceRows.tsx',
  'components/mobile/sheets/SettingsSheet.tsx',
  'components/mobile/sheets/SheetHost.tsx',
  'components/mobile/nav/BottomNav.tsx',
  'mobile/calendarResume.ts',
];

describe('calendar view choice is phone-only', () => {
  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone calendar mounts the chooser', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<CalendarViewChooser');
  });

  it('the phone Profile opens the settings sheet', () => {
    expect(read('components/mobile/screens/ProfileScreen.tsx')).toContain("kind: 'settings'");
  });

  it.each(['components/WeeklyCalendar/index.tsx', 'components/Sidebar/ProfilePopup.tsx'])(
    '%s has no calendar view choice',
    (file) => {
      const src = read(file);
      expect(src).not.toContain('CalendarViewChooser');
      expect(src).not.toContain('saveCalendarView');
      expect(src).not.toContain('SettingsSheet');
    }
  );
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run calendarViewChoiceIsPhoneOnly`
Expected: PASS (it pins state reached in Tasks 2–4).

- [ ] **Step 3: Commit**

```bash
git add src/test/guards/calendarViewChoiceIsPhoneOnly.test.ts
git commit -m "test(guards): the calendar view choice is phone-only, on purpose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify on screen, then open the PR

**Files:** none changed unless measurement demands (then `calendarBottomPad.ts` `CHOOSER_PAD`, or Profile spacing).

- [ ] **Step 1: Capture "before" PNGs**

Check out the base commit `edcfac21` in a throwaway worktree (`git worktree add <scratch>/before edcfac21`; never `git stash` — the stash stack is shared across sessions) and run `verify-ui` there. Capture calendar (day, week) and Profile at 390 wide, dark and light. Remove the worktree afterwards.

- [ ] **Step 2: Run the `verify-ui` skill on this branch**

Invoke the `verify-ui` skill. States to cover, each at 320, 390, 430 and tablet width (834), both themes:
1. Calendar day view with the chooser (`calendarViewChosen: false`).
2. Calendar week view with the chooser — assert the week grid's last row bottom ≤ the chooser's top (no overlap) and nothing clipped.
3. Calendar day and week without the chooser — assert the last agenda row / grid bottom clears the tab bar, and no band of dead space where the switch was.
4. Profile at 375×667 base case, and with both admin rows (`adminSession`, `adminRole: 'reis_admin'`) — record whether it fits; if the base case scrolls, report it, do not silently drop the EY block.
5. Nastavení sheet open.
Contrast: the tonal segments and the save button in light theme (≥ 4.5:1 for text).

If (2) overlaps, raise `CHOOSER_PAD` in `calendarBottomPad.ts` to the measured chooser top + 8px, rerun `npx vitest run CalendarScreen`, commit `fix(calendar): reserve the chooser's measured band`.

- [ ] **Step 3: iPad**

Per the `ipad-device` memory: build, install and screenshot on the cabled iPad 8 (portrait 810×1080 and landscape) — chooser and Nastavení sheet. Never the iOS simulator.

- [ ] **Step 4: Send before/after PNGs to Dominik**

`SendUserFile` the before/after pairs (calendar day, week, chooser, Profile, Nastavení sheet) before calling it done.

- [ ] **Step 5: Push and open the PR against `test`**

```bash
git push -u personal claude/calendar-view-onboarding-3022ef
gh pr create --base test --title "feat(calendar): choose Den or Týden once; it lives in Nastavení" --body "<summary of spec + verification; ends with 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```

Then enable Auto-fix (memory: always), bind the PR with the ccd_pr tools, and leave merging to Dominik. What's new copy is agreed with Dominik at release, not in this PR.
