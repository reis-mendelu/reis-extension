# Schedule-First Cold Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a brand-new student see their real class schedule within ~2 seconds of first open, with no commitment ask before value, so the Fall 2026 event converts a cold-start crowd.

**Architecture:** Content-script change emits a schedule-only `syncUpdate` the moment the schedule resolves, before the rest of the 8-way sync batch. The iframe already applies partial schedule updates, so the calendar paints early. A branded "building your week" state (with a retry affordance on failure) replaces the generic skeleton during first sync. Onboarding's Outlook/Drive asks move out of the blocking flow; Outlook returns as a dismissible in-calendar nudge after the schedule paints.

**Tech Stack:** WXT, React 19, Zustand, DaisyUI 5, motion/react, Vitest + happy-dom + Testing Library, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-06-02-schedule-first-cold-start-design.md`
**Mockup:** `docs/superpowers/specs/2026-06-02-schedule-first-cold-start-mockup.html`

**Conventions to honor (from CLAUDE.md / memory):**
- DaisyUI semantic classes only; no custom CSS; Inter font; mendelu-dark default.
- Max 200 lines/file; direct imports (no barrels); TDD (failing test first).
- Run `npm run build` after changes; one-line commit messages; no Co-Authored-By.
- Every `input-bordered`/`textarea-bordered` needs `focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20` (not used here, but note for any input).
- Do NOT touch IS parsers or Drive/OAuth internals.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/injector/syncService.ts` | Emit schedule-only update before batch | Modify (~line 108–117) |
| `src/injector/__tests__/scheduleFirst.test.ts` | Test the early-emit seam | Create |
| `src/i18n/locales/cs.json`, `en.json` | Honest first-run copy + nudge strings | Modify |
| `src/components/WeeklyCalendar/BuildingWeek.tsx` | Branded first-run state + retry | Create |
| `src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx` | Test building/retry render | Create |
| `src/components/WeeklyCalendar/index.tsx` | Render BuildingWeek when first-sync | Modify (~line 30, 116) |
| `src/components/WeeklyCalendar/OutlookNudge.tsx` | Dismissible in-calendar Outlook ask | Create |
| `src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx` | Test nudge render + dismissal | Create |
| `src/components/Onboarding/WelcomeModal.tsx` | Strip Outlook/Drive from blocking flow | Modify |
| `src/components/Onboarding/__tests__/WelcomeModal.test.tsx` | Test no asks in welcome | Create |

---

## Task 1: Schedule-first emit (content script)

**Files:**
- Modify: `src/injector/syncService.ts` (the `syncAllData()` body, ~line 108–117; add an exported `emitScheduleFirst` seam)
- Test: `src/injector/__tests__/scheduleFirst.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/injector/__tests__/scheduleFirst.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));

import { sendToIframe } from '../iframeManager';
import { emitScheduleFirst } from '../syncService';

describe('emitScheduleFirst', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends a schedule-only REIS_SYNC_UPDATE with isSyncing true', () => {
        const schedule = [{ id: 'x' }] as any;
        emitScheduleFirst(schedule, 1234);
        expect(sendToIframe).toHaveBeenCalledTimes(1);
        const msg = (sendToIframe as any).mock.calls[0][0];
        expect(msg.type).toBe('REIS_SYNC_UPDATE');
        expect(msg.data.schedule).toBe(schedule);
        expect(msg.data.isSyncing).toBe(true);
        expect(msg.data.lastSync).toBe(1234);
        // schedule-only: must NOT carry the heavy batch fields
        expect(msg.data.subjects).toBeUndefined();
        expect(msg.data.exams).toBeUndefined();
    });

    it('does not emit when schedule is empty', () => {
        emitScheduleFirst([] as any, 1234);
        expect(sendToIframe).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/injector/__tests__/scheduleFirst.test.ts`
Expected: FAIL — `emitScheduleFirst` is not exported from `../syncService`.

- [ ] **Step 3: Add the emit seam to `syncService.ts`**

Near the top of `src/injector/syncService.ts` (after the existing imports of `Messages` and `sendToIframe`), add the exported seam:

```ts
// Emit the student's schedule the instant it resolves — before the rest of the
// sync batch settles — so the calendar paints in ~1–3s on first open.
export function emitScheduleFirst(schedule: unknown[] | undefined, lastSync: number) {
    if (!schedule || schedule.length === 0) return;
    sendToIframe(Messages.syncUpdate({ schedule: schedule as never, isSyncing: true, lastSync }));
}
```

- [ ] **Step 4: Wire the seam into `syncAllData()`**

In `src/injector/syncService.ts`, inside `syncAllData()`, replace the inline `fetchFullSemesterSchedule()` call in the `Promise.allSettled` array (currently line ~109) with a hoisted promise that emits early. Just above the `const [fullSchedule, ...] = await Promise.allSettled([` line, add:

```ts
        const earlyLastSync = Date.now();
        const schedulePromise = fetchFullSemesterSchedule().then((s) => {
            emitScheduleFirst(s as unknown[], earlyLastSync);
            return s;
        });
```

Then change the first element of the `Promise.allSettled([ ... ])` array from:

```ts
            fetchFullSemesterSchedule(),
```

to:

```ts
            schedulePromise,
```

Leave the rest of the batch and the post-batch `sendToIframe(Messages.syncUpdate({ ... }))` (line ~163) unchanged — it still sends the full data set.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/injector/__tests__/scheduleFirst.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: no errors. (If `Messages.syncUpdate`'s `SyncedData` type rejects the `schedule` cast, use `schedule: schedule as never` as shown.)

- [ ] **Step 7: Commit**

```bash
git add src/injector/syncService.ts src/injector/__tests__/scheduleFirst.test.ts
git commit -m "feat(sync): paint schedule first, before the rest of the sync batch"
```

---

## Task 2: Honest first-run copy (i18n)

**Files:**
- Modify: `src/i18n/locales/cs.json` (the `onboarding` and `calendar` objects)
- Modify: `src/i18n/locales/en.json` (same)

No separate test — covered by build + the component tests in later tasks, which reference these keys.

- [ ] **Step 1: Add building/nudge keys to `cs.json`**

In `src/i18n/locales/cs.json`, inside the `"calendar"` object add:

```json
"buildingWeek": "Sestavujeme tvůj týden…",
"buildingWeekSub": "Tvůj rozvrh bude hotový za pár vteřin.",
"buildingWeekFailed": "Rozvrh se nepodařilo načíst.",
"retry": "Zkusit znovu",
"loadingMaterials": "načítám materiály…",
"outlookNudgeTitle": "Chceš rozvrh v mobilu?",
"outlookNudgeBody": "Synchronizuj rozvrh do kalendáře v Outlooku.",
"outlookNudgeCta": "Nastavit sync"
```

In the `"onboarding"` object, remove the `"syncCoffeeBreak"` line (it is no longer referenced after Task 4).

- [ ] **Step 2: Add the same keys to `en.json`**

In `src/i18n/locales/en.json`, inside `"calendar"` add:

```json
"buildingWeek": "Building your week…",
"buildingWeekSub": "Your schedule will be ready in a few seconds.",
"buildingWeekFailed": "Couldn't load your schedule.",
"retry": "Try again",
"loadingMaterials": "loading materials…",
"outlookNudgeTitle": "Want this on your phone?",
"outlookNudgeBody": "Sync your schedule to your Outlook calendar.",
"outlookNudgeCta": "Set up sync"
```

In `"onboarding"`, remove `"syncCoffeeBreak"`.

- [ ] **Step 3: Verify both locales parse and have matching keys**

Run:
```bash
node -e "const a=Object.keys(require('./src/i18n/locales/cs.json').calendar).sort(); const b=Object.keys(require('./src/i18n/locales/en.json').calendar).sort(); const miss=a.filter(k=>!b.includes(k)).concat(b.filter(k=>!a.includes(k))); console.log(miss.length? 'MISMATCH: '+miss : 'calendar keys match')"
```
Expected: `calendar keys match`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "i18n(calendar): honest first-run + outlook nudge strings; drop coffee-break"
```

---

## Task 3: Branded "building your week" state + retry

**Files:**
- Create: `src/components/WeeklyCalendar/BuildingWeek.tsx`
- Test: `src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx`
- Modify: `src/components/WeeklyCalendar/index.tsx` (~line 30 destructure, ~line 116 skeleton branch)

`BuildingWeek` shows the branded loading state while the first sync is in flight, and a retry button once the 10s `handshakeTimedOut` fires with still no schedule (the failure case). Retry re-triggers a full sync via `requestData('all')`.

- [ ] **Step 1: Write the failing test**

Create `src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const requestData = vi.fn();
vi.mock('../../../api/proxyClient', () => ({ requestData: (t: string) => requestData(t) }));
vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (k: string) => k, language: 'en' }),
}));

import { BuildingWeek } from '../BuildingWeek';

describe('BuildingWeek', () => {
    it('shows the building message while loading (not timed out)', () => {
        render(<BuildingWeek timedOut={false} />);
        expect(screen.getByText('calendar.buildingWeek')).toBeInTheDocument();
        expect(screen.queryByText('calendar.retry')).not.toBeInTheDocument();
    });

    it('shows a retry button after timeout and re-requests data on click', () => {
        render(<BuildingWeek timedOut={true} />);
        expect(screen.getByText('calendar.buildingWeekFailed')).toBeInTheDocument();
        fireEvent.click(screen.getByText('calendar.retry'));
        expect(requestData).toHaveBeenCalledWith('all');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx`
Expected: FAIL — cannot find `../BuildingWeek`.

- [ ] **Step 3: Create `BuildingWeek.tsx`**

```tsx
import { requestData } from '../../api/proxyClient';
import { useTranslation } from '../../hooks/useTranslation';

interface BuildingWeekProps {
    /** True once the 10s handshake backstop fired with still no schedule. */
    timedOut: boolean;
}

export function BuildingWeek({ timedOut }: BuildingWeekProps) {
    const { t } = useTranslation();

    if (timedOut) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-sm font-semibold text-base-content/70">{t('calendar.buildingWeekFailed')}</p>
                <button className="btn btn-primary btn-sm rounded-field" onClick={() => requestData('all')}>
                    {t('calendar.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <div>
                    <p className="text-sm font-bold leading-none">{t('calendar.buildingWeek')}</p>
                    <p className="mt-1 text-xs text-base-content/50">{t('calendar.buildingWeekSub')}</p>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className="skeleton h-14 rounded-field" />
                <div className="skeleton h-10 rounded-field" />
                <div className="skeleton h-16 rounded-field" />
                <div className="skeleton h-10 rounded-field" />
            </div>
        </div>
    );
}
```

(`skeleton` is DaisyUI's built-in shimmer class — no custom CSS.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire `BuildingWeek` into the calendar**

In `src/components/WeeklyCalendar/index.tsx`:

Add the import near the other component imports:

```tsx
import { BuildingWeek } from './BuildingWeek';
```

In the `useCalendarData(...)` destructure (line ~30), also pull `isScheduleLoaded` (already returned by the hook) and read the timeout flag from the store. Add near the top of the component body:

```tsx
    const handshakeTimedOut = useAppStore(state => state.syncStatus.handshakeTimedOut);
```

(If `useAppStore` is not yet imported in this file, add `import { useAppStore } from '../../store/useAppStore';`.)

Then, in the render where the skeleton path is taken (the early `if (showSkeleton) { ... }` block around line 116 that currently renders the skeleton grid), return the branded state instead. Replace the body of that skeleton branch's returned JSX so it renders:

```tsx
        return (
            <div className="h-full">
                <BuildingWeek timedOut={handshakeTimedOut} />
            </div>
        );
```

Keep the existing non-skeleton render path (the real calendar grid) unchanged.

- [ ] **Step 6: Typecheck + build + run calendar tests**

Run: `npm run typecheck && npx vitest run src/components/WeeklyCalendar`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/WeeklyCalendar/BuildingWeek.tsx src/components/WeeklyCalendar/__tests__/BuildingWeek.test.tsx src/components/WeeklyCalendar/index.tsx
git commit -m "feat(calendar): branded 'building your week' first-run state with retry"
```

---

## Task 4: Defer onboarding asks (WelcomeModal)

**Files:**
- Modify: `src/components/Onboarding/WelcomeModal.tsx` (collapse to a single welcome step; remove Outlook + Drive)
- Test: `src/components/Onboarding/__tests__/WelcomeModal.test.tsx`

The modal becomes one screen: greeting + language toggle + "Let's go" (dismiss). Step 2 (Outlook toggle + Drive connect) is removed. `useOutlookSync` and `useDriveBackup` imports are dropped.

- [ ] **Step 1: Write the failing test**

Create `src/components/Onboarding/__tests__/WelcomeModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const idb = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) };
vi.mock('../../../services/storage', () => ({ IndexedDBService: idb }));
vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (k: string) => k, language: 'cz' }),
}));
vi.mock('../../../store/useAppStore', () => ({ useAppStore: (sel: any) => sel({ setLanguage: vi.fn() }) }));

import { WelcomeModal } from '../WelcomeModal';

describe('WelcomeModal', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });

    it('shows welcome + language only, with no Outlook or Drive ask', async () => {
        render(<WelcomeModal />);
        // checkWelcome runs an async IDB read then an 800ms visibility timer
        await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(900); });
        expect(screen.getByText('onboarding.welcome')).toBeInTheDocument();
        expect(screen.getByText('onboarding.getStarted')).toBeInTheDocument();
        expect(screen.queryByText('onboarding.syncTitle')).not.toBeInTheDocument();
        expect(screen.queryByText('onboarding.driveTitle')).not.toBeInTheDocument();
        vi.useRealTimers();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Onboarding/__tests__/WelcomeModal.test.tsx`
Expected: FAIL — `onboarding.syncTitle` / `driveTitle` still render (step 2 exists).

- [ ] **Step 3: Collapse `WelcomeModal.tsx` to one step**

In `src/components/Onboarding/WelcomeModal.tsx`:

1. Remove these imports (no longer used):
   - `import { useOutlookSync } from '../../hooks/data/useOutlookSync';`
   - `import { useDriveBackup } from '../../hooks/data/useDriveBackup';`
   - `Info` from the lucide import (keep `Check`).
2. Remove the `step` state and the `useOutlookSync` / `useDriveBackup` hook calls.
3. Change `handleNext` to dismiss directly:

```tsx
    const handleNext = () => handleDismiss();
```

4. Delete the entire `step === 1 ? (...) : (...)` conditional and the `step === 2` JSX block. Keep only the step-1 content (logo, `onboarding.welcome`, `onboarding.description`, the CZ/EN `join` toggle, and the primary `handleNext` button). The button label stays `onboarding.getStarted`.
5. Simplify the outer panel width class to the step-1 variant only: replace the template-literal `className` on the motion panel with the static `max-w-sm sm:max-w-lg` size (drop the `step === 1 ? ... : ...` ternary).

The resulting file must be < 200 lines and contain no reference to `step`, `isEnabled`, `toggle`, `driveConnect`, `driveConnected`, `driveBusy`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Onboarding/__tests__/WelcomeModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: no errors, no unused-import warnings for the removed hooks.

- [ ] **Step 6: Commit**

```bash
git add src/components/Onboarding/WelcomeModal.tsx src/components/Onboarding/__tests__/WelcomeModal.test.tsx
git commit -m "feat(onboarding): one welcome screen, defer Outlook/Drive asks"
```

---

## Task 5: Dismissible in-calendar Outlook nudge

**Files:**
- Create: `src/components/WeeklyCalendar/OutlookNudge.tsx`
- Test: `src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx`
- Modify: `src/components/WeeklyCalendar/index.tsx` (render `<OutlookNudge />` above the grid in the non-skeleton path)

The nudge appears only once the schedule has painted (the calendar's non-skeleton render path) and is not yet dismissed. Dismissal persists in IDB `meta` key `outlook_nudge_dismissed`. Clicking the CTA enables Outlook sync via the existing `useOutlookSync().toggle`.

- [ ] **Step 1: Write the failing test**

Create `src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const idb = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) };
vi.mock('../../../services/storage', () => ({ IndexedDBService: idb }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k, language: 'en' }) }));
const toggle = vi.fn();
vi.mock('../../../hooks/data/useOutlookSync', () => ({ useOutlookSync: () => ({ isEnabled: false, toggle, isLoading: false }) }));

import { OutlookNudge } from '../OutlookNudge';

describe('OutlookNudge', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the nudge when not previously dismissed', async () => {
        render(<OutlookNudge />);
        expect(await screen.findByText('calendar.outlookNudgeTitle')).toBeInTheDocument();
    });

    it('persists dismissal and hides on close', async () => {
        render(<OutlookNudge />);
        const close = await screen.findByLabelText('common.close');
        await act(async () => { fireEvent.click(close); });
        expect(idb.set).toHaveBeenCalledWith('meta', 'outlook_nudge_dismissed', true);
        await waitFor(() => expect(screen.queryByText('calendar.outlookNudgeTitle')).not.toBeInTheDocument());
    });

    it('does not render when already dismissed', async () => {
        idb.get.mockResolvedValueOnce(true);
        render(<OutlookNudge />);
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByText('calendar.outlookNudgeTitle')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx`
Expected: FAIL — cannot find `../OutlookNudge`.

- [ ] **Step 3: Create `OutlookNudge.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { IndexedDBService } from '../../services/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useOutlookSync } from '../../hooks/data/useOutlookSync';
import { logError } from '../../utils/reportError';

export function OutlookNudge() {
    const { t } = useTranslation();
    const { isEnabled, toggle, isLoading } = useOutlookSync();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        IndexedDBService.get('meta', 'outlook_nudge_dismissed')
            .then(dismissed => { if (!dismissed) setVisible(true); })
            .catch(e => logError('OutlookNudge.check', e));
    }, []);

    const dismiss = () => {
        setVisible(false);
        IndexedDBService.set('meta', 'outlook_nudge_dismissed', true).catch(e => logError('OutlookNudge.dismiss', e));
    };

    if (!visible || isEnabled) return null;

    return (
        <div className="relative mb-2 rounded-field border border-accent/25 bg-accent/10 px-3 py-2.5 pr-9">
            <button
                aria-label={t('common.close')}
                className="btn btn-ghost btn-xs btn-circle absolute right-1.5 top-1.5"
                onClick={dismiss}
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <p className="flex items-center gap-1.5 text-xs font-bold">
                <Smartphone className="h-3.5 w-3.5" /> {t('calendar.outlookNudgeTitle')}
            </p>
            <p className="mt-0.5 text-[11px] text-base-content/60">{t('calendar.outlookNudgeBody')}</p>
            <button
                className="btn btn-accent btn-xs mt-2 rounded-field"
                disabled={isLoading}
                onClick={toggle}
            >
                {t('calendar.outlookNudgeCta')}
            </button>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Render the nudge in the calendar (non-skeleton path)**

In `src/components/WeeklyCalendar/index.tsx`, add the import:

```tsx
import { OutlookNudge } from './OutlookNudge';
```

In the main (non-skeleton) return JSX (the `return (` at ~line 166), render `<OutlookNudge />` just inside the top-level container, above the calendar header/grid:

```tsx
            <OutlookNudge />
```

Place it so it appears above the week grid but inside the scrollable calendar container. Do not render it in the `showSkeleton`/`BuildingWeek` branch — it must only show after the schedule paints.

- [ ] **Step 6: Typecheck + build + calendar tests**

Run: `npm run typecheck && npx vitest run src/components/WeeklyCalendar`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/WeeklyCalendar/OutlookNudge.tsx src/components/WeeklyCalendar/__tests__/OutlookNudge.test.tsx src/components/WeeklyCalendar/index.tsx
git commit -m "feat(calendar): dismissible Outlook sync nudge after schedule paints"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test:run`
Expected: all green, including the four new test files.

- [ ] **Step 2: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: no errors. Confirm no leftover reference to `onboarding.syncCoffeeBreak`:

```bash
grep -rn "syncCoffeeBreak" src || echo "OK: no syncCoffeeBreak references"
```
Expected: `OK: no syncCoffeeBreak references`.

- [ ] **Step 3: Manual smoke (optional, dev)**

Run `npm run dev`, load on `is.mendelu.cz` with a fresh profile (clear extension IDB), confirm: welcome modal is one screen with no Drive/Outlook ask; calendar shows "building your week" then paints the schedule before files finish; Outlook nudge appears after paint and dismisses permanently.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git add -A && git commit -m "test: verify schedule-first cold start end to end"
```

---

## Self-Review

**Spec coverage:**
- §Component 1 (schedule-first paint) → Task 1. ✓
- §Component 2 (honest first-run state + retry) → Task 3 (+ copy in Task 2). ✓
- §Component 3 (defer commitment asks) → Task 4. ✓ (Drive ask already lives in file drawer; no code needed beyond removing it from WelcomeModal.)
- §Component 4 (honest copy) → Task 2. ✓
- §Visual design frames 1–4 → Tasks 4, 3, 1+3, 5 respectively. ✓
- §Testing (4 test targets: syncService ordering, isFirstSync/building, WelcomeModal no-asks, nudge) → Tasks 1, 3, 4, 5. ✓
- §Out of scope (cached shell, Drive/parser changes) → not touched. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command shows expected output. ✓

**Type/name consistency:** `emitScheduleFirst(schedule, lastSync)` defined and used identically (Task 1). `BuildingWeek` prop `timedOut: boolean` consistent across test + component + wiring (Task 3). i18n keys (`calendar.buildingWeek`, `buildingWeekFailed`, `retry`, `loadingMaterials`, `outlookNudge*`) defined in Task 2 and referenced in Tasks 3 & 5. `outlook_nudge_dismissed` IDB key consistent across component + test (Task 5). ✓

**Note on `loadingMaterials` chip:** the streaming chip (mockup frame 3) is honest copy already added in Task 2; wiring it into the calendar header is a trivial follow-up but not required for the core "schedule paints first" win — left for a fast-follow to keep this plan focused. The header already stops showing the skeleton once the schedule lands, so the core goal holds without it.
