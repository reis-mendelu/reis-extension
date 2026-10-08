# Society Events Reduction: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut society events down to "an event exists, quietly". Remove follow, RSVP, reminders and the digest. Decide audience automatically. Add three per-event admin numbers.

**Architecture:**
- **One pure audience rule.** `audienceOf` / `canSee` in `utils/eventAudience.ts` take a `Viewer` (faculty, Erasmus), built from the store or from an active impersonation. They replace the follow list everywhere events are shown: map pins, the Akce list, the peek band and Novinky.
- **RSVP, follow and the reminder machinery are deleted.** A one-time device cleanup removes what they left behind.
- **New event counters.** A second PR adds once-per-device Seen / Opened / Link counters. They are written to new columns on `event_map_views` and read by a society-scoped admin RPC.

**Tech Stack:** React 19, Zustand slices, IndexedDB (`IndexedDBService`), Supabase (anon + `adminAuthClient`), Capacitor, Vitest + Testing Library, DaisyUI/Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-08-society-events-reduction-design.md` (read it first; it records why each cut was made).

## Global Constraints

- **Both trees.** Every student-facing change lands on the phone/iPad tree and the desktop tree. The peek band is phone-only by existing design. Verify at 320/390/430 and at tablet width (`verify-ui` skill).
- **No `localStorage` / `sessionStorage`.** Use IndexedDB `meta` only.
- **No custom CSS.** Use DaisyUI/Tailwind classes; Tailwind arbitrary properties like `[-webkit-touch-callout:none]` are allowed.
- **Max 200 lines per file.** `EventLayer.tsx` is already 233, so new logic goes in new files.
- **Direct imports only.** Never add to `services/spolky/index.ts` (a barrel); import from implementation files.
- **No `useEffect` for data fetching.** Fire-and-forget counter writes from observers are allowed, as `NotificationItem` does today.
- **Errors go through `logError(context, err)`.** Contexts follow `Slice.method` / `Api.fetchX` / `Cleanup.x`.
- **Counter privacy.**
  - Event counters send an event id and nothing else: no install id, ever.
  - Each one is gated by `writesAllowed()` (no demo, no harness) and `hasDataConsent('technicalAndInteraction')`.
  - Never pair an event id with an install id.
- **Write nuia-clean TypeScript.** `noUncheckedIndexedAccess`: index results are `T | undefined`.
- **Tests first.** Per task, run `npx vitest run <pattern>` plus `npm run typecheck`. If load times out workers, add `--no-file-parallelism --maxWorkers=1`. Leave repo-wide lint, format and `test:run` to CI.
- **Keep server-side for old builds (5.1.1–5.3.0):**
  - `event_rsvps`, `set_event_rsvp`, `get_event_rsvps`
  - `increment_post_view` / `increment_post_click`
  - `increment_event_map_view`
  - `spolky_events.view_count` / `click_count`
  - `societies.auto_follow_faculty`
  
  Drop none of them.
- **Keep `@capacitor/local-notifications` and Android `POST_NOTIFICATIONS` this release.** Task 7's cleanup needs them.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Branches

- **PR 1 (Tasks 1–10).** Branch `claude/society-events-redesign-54f4bf`, which already carries the spec. Open it against `test`.
- **PR 2 (Tasks 11–15).** A branch cut from PR 1's head. Open it against `test` only after PR 1 has merged, so it is never stacked.
- No release is cut from `test` between the two. `test` already carries #475, which PR 1 removes.

## File map

| File | Change | PR |
| --- | --- | --- |
| `src/utils/eventAudience.ts` | rewrite: `Viewer`, `audienceOf`, `canSee`, `visibleToStudent`, `audienceLabelKey` | 1 |
| `src/hooks/useViewer.ts` | new: viewer from the store or the impersonation | 1 |
| `src/hooks/useVisibleMapEvents.ts` | use the viewer and catalog | 1 |
| `src/store/slices/createContextSlice.ts` | cache the viewer audience in `meta` | 1 |
| `src/services/spolky/spolkyService.ts`, `src/hooks/useNotificationFeed.ts` | Novinky: 7 days, filtered by audience | 1 |
| `src/components/CampusMap/eventWindow.ts` | `NOVINKY_WINDOW_DAYS = 7` | 1 |
| RSVP, reminder and follow files (Tasks 4 and 6) | delete | 1 |
| `src/hooks/ui/useLongPress.ts` | new | 1 |
| `src/services/cleanup/retireSocietyFeatures.ts` | new | 1 |
| `src/test/guards/societyEventsStayReduced.test.ts` | new guard | 1 |
| `supabase/migrations/20261009120000_event_signals.sql` | new | 2 |
| `src/api/eventSignals.ts`, `src/api/eventSignalsAdmin.ts` | new | 2 |
| `src/hooks/ui/useSeenSignal.ts`, `src/components/CampusMap/usePinsSeen.ts` | new | 2 |
| `src/components/AdminConsole/EventStats.tsx`, `FeatureSignals.tsx` | rewrite / trim | 2 |

---

# PR 1: Reduction

### Task 1: The audience rule

**Files:**
- Modify: `src/utils/eventAudience.ts` (whole file)
- Test: `src/utils/__tests__/eventAudience.test.ts` (replace contents)

**Interfaces:**
- Produces:
  - `export interface Viewer { facultyKey: FacultyKey | null; erasmus: boolean }`
  - `export type Audience = 'everyone' | 'erasmus' | Exclude<FacultyKey, 'mendelu'>`
  - `audienceOf(society: Society | undefined): Audience`
  - `canSee(event: { societyId: string; subscribersOnly?: boolean }, societies: Record<string, Society>, viewer: Viewer): boolean`
  - `visibleToStudent<T extends { societyId: string; subscribersOnly?: boolean }>(events: T[], societies: Record<string, Society>, viewer: Viewer): T[]`
  - `audienceLabelKey(society): { key: 'admin.audience.faculty' | 'admin.audience.erasmus'; faculty?: string } | null`, where `null` means it cannot be restricted

- [ ] **Step 1: Write the failing test.** Replace `src/utils/__tests__/eventAudience.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { audienceOf, canSee, visibleToStudent, audienceLabelKey, type Viewer } from '../eventAudience';
import type { Society } from '../../types/events';

const cat: Record<string, Society> = Object.fromEntries(
  BUNDLED_SOCIETIES.map((s) => [s.id, s])
);
const pef: Viewer = { facultyKey: 'pef', erasmus: false };
const frrms: Viewer = { facultyKey: 'frrms', erasmus: false };
const erasmusPef: Viewer = { facultyKey: 'pef', erasmus: true };
const unknown: Viewer = { facultyKey: null, erasmus: false };
const ev = (societyId: string, subscribersOnly?: boolean) => ({ societyId, subscribersOnly });

describe('audienceOf', () => {
  it.each([
    ['supef', 'pef'],
    ['ey', 'pef'],
    ['au_frrms', 'frrms'],
    ['usaf', 'af'],
    ['ldf', 'ldf'],
    ['zf', 'zf'],
    ['esn', 'erasmus'],
    ['reis', 'everyone'],
  ])('%s → %s', (id, expected) => {
    expect(audienceOf(cat[id])).toBe(expected);
  });
  it('an unknown society has no audience of its own', () => {
    expect(audienceOf(undefined)).toBe('everyone');
  });
});

describe('canSee', () => {
  it('public events are for everyone', () => {
    expect(canSee(ev('esn', false), cat, frrms)).toBe(true);
    expect(canSee(ev('supef'), cat, unknown)).toBe(true);
  });
  it('a faculty society restricts to its faculty, strictly', () => {
    expect(canSee(ev('supef', true), cat, pef)).toBe(true);
    expect(canSee(ev('supef', true), cat, frrms)).toBe(false);
    expect(canSee(ev('ey', true), cat, pef)).toBe(true);
  });
  it('ESN restricts to Erasmus students', () => {
    expect(canSee(ev('esn', true), cat, pef)).toBe(false);
    expect(canSee(ev('esn', true), cat, erasmusPef)).toBe(true);
  });
  it('an Erasmus student also belongs to their faculty', () => {
    expect(canSee(ev('supef', true), cat, erasmusPef)).toBe(true);
  });
  it('reIS cannot be restricted', () => {
    expect(canSee(ev('reis', true), cat, unknown)).toBe(true);
  });
  it('an unknown faculty sees public events only', () => {
    expect(canSee(ev('supef', true), cat, unknown)).toBe(false);
  });
  it('a restricted event of a society missing from the catalog is hidden', () => {
    expect(canSee(ev('ghost', true), cat, pef)).toBe(false);
  });
});

describe('visibleToStudent', () => {
  it('keeps order and drops what the viewer may not see', () => {
    const list = [ev('supef', true), ev('esn', true), ev('reis')];
    expect(visibleToStudent(list, cat, pef)).toEqual([list[0], list[2]]);
  });
});

describe('audienceLabelKey', () => {
  it('names the faculty, EY included', () => {
    expect(audienceLabelKey(cat.ey)).toEqual({ key: 'admin.audience.faculty', faculty: 'PEF' });
  });
  it('names Erasmus for ESN', () => {
    expect(audienceLabelKey(cat.esn)).toEqual({ key: 'admin.audience.erasmus' });
  });
  it('reIS has nothing to restrict to', () => {
    expect(audienceLabelKey(cat.reis)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/utils/__tests__/eventAudience.test.ts`. Expected: FAIL, because `audienceOf` and `canSee` are not exported.

- [ ] **Step 3: Implement.** Replace `src/utils/eventAudience.ts`:

```ts
import type { FacultyKey, Society } from '../types/events';

/**
 * Who a society event is for, decided from who the student is — never from a
 * list they keep. `subscribers_only` on `spolky_events` means "for the
 * society's own people": its faculty's students, or the Erasmus students for
 * ESN. reIS is university-wide and cannot be restricted.
 *
 * NOISE CONTROL, NOT ACCESS CONTROL. The fetch is anonymous, so a restricted
 * event still comes down the wire; this decides what a student is SHOWN.
 *
 * Old builds (5.1.1–5.3.0) read the same column through follows, and auto-follow
 * the faculty society and ESN for Erasmus — the same audience, approximately,
 * which is why the column was reused rather than replaced.
 */
export interface Viewer {
  /** null when not known yet (first launch before IS data) — sees public only. */
  facultyKey: FacultyKey | null;
  erasmus: boolean;
}

export type Audience = 'everyone' | 'erasmus' | Exclude<FacultyKey, 'mendelu'>;

export function audienceOf(society: Society | undefined): Audience {
  if (society?.audienceLabel === 'erasmus') return 'erasmus';
  if (society && society.facultyKey !== 'mendelu') return society.facultyKey;
  return 'everyone';
}

/** A student belongs to every audience that fits: an Erasmus student at PEF is both. */
export function canSee(
  event: { societyId: string; subscribersOnly?: boolean },
  societies: Record<string, Society>,
  viewer: Viewer
): boolean {
  if (!event.subscribersOnly) return true;
  const society = societies[event.societyId];
  // Restricted, by a society we cannot name: hide rather than guess an audience.
  if (!society) return false;
  const audience = audienceOf(society);
  if (audience === 'everyone') return true;
  if (audience === 'erasmus') return viewer.erasmus;
  return viewer.facultyKey === audience;
}

export function visibleToStudent<T extends { societyId: string; subscribersOnly?: boolean }>(
  events: T[],
  societies: Record<string, Society>,
  viewer: Viewer
): T[] {
  return events.filter((e) => canSee(e, societies, viewer));
}

/** How the composer names the restricted option; null = this society cannot restrict. */
export function audienceLabelKey(
  society: Society | undefined
): { key: 'admin.audience.faculty' | 'admin.audience.erasmus'; faculty?: string } | null {
  const audience = audienceOf(society);
  if (audience === 'everyone') return null;
  if (audience === 'erasmus') return { key: 'admin.audience.erasmus' };
  return { key: 'admin.audience.faculty', faculty: audience.toUpperCase() };
}
```

- [ ] **Step 4: Run it and confirm it passes.** Run `npx vitest run src/utils/__tests__/eventAudience.test.ts`. Expected: PASS.

- [ ] **Step 5: Update the composer field.** In `src/components/CampusMap/ComposerAudienceField.tsx`:
  - Delete the `audienceHint` import and its use.
  - Return `null` when `audienceLabelKey(society)` is `null`.
  - Render the label with `audience.key` / `audience.faculty`.
  - Replace the hint paragraph text with `t('map.audienceHint')` (no variables).
  - Rewrite the doc comment: the label now names exactly who sees the event, so it no longer approximates anything.

  In `src/i18n/locales/cs.json` and `en.json`:
  - Set `map.audienceHint` to "Ostatní studenti tuto akci na mapě ani v Novinkách neuvidí." / "Other students won't see this event on the map or in Novinky."
  - Delete `map.audienceHintGeneric` and `admin.audience.followers`.

  Update `src/components/CampusMap/__tests__/EventComposer.test.tsx`:
  - Assertions that expect "Jen odběratelé" or the follower hint expect the faculty label or the new hint instead.
  - Add one case: a `reis` composer renders no audience checkbox.

- [ ] **Step 6: Run the tests.** Run `npx vitest run src/utils/__tests__/eventAudience.test.ts src/components/CampusMap/__tests__/EventComposer.test.tsx`. Expected: PASS. `npm run typecheck` is expected to fail at this point, only in `useVisibleMapEvents.ts`; Task 2 fixes it.

- [ ] **Step 7: Commit.**
```bash
git add src/utils/eventAudience.ts src/utils/__tests__/eventAudience.test.ts src/components/CampusMap/ComposerAudienceField.tsx src/components/CampusMap/__tests__/EventComposer.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(events): decide an event's audience from who the student is"
```

### Task 2: The viewer, including impersonation and cold start

**Files:**
- Create: `src/hooks/useViewer.ts`
- Modify:
  - `src/hooks/useVisibleMapEvents.ts`
  - `src/store/slices/createContextSlice.ts`
  - `src/store/useAppStore.ts:283-288` (sync handler)
  - `capacitor/startApp.ts:145-149` (resume)
- Test:
  - `src/hooks/__tests__/useViewer.test.ts`
  - `src/store/slices/__tests__/createContextSlice.viewerCache.test.ts`

**Interfaces:**
- Consumes: `Viewer`, `visibleToStudent` (Task 1); `FACULTY_LABEL_TO_KEY` (`src/types/events.ts:113`).
- Produces:
  - `viewerFrom(facultyLabel: string | null, erasmus: boolean): Viewer`
  - `useViewer(): Viewer`
  - meta key `'viewer_audience'` with value `{ faculty: string | null; erasmus: boolean }`

- [ ] **Step 1: Write the failing hook test.** Create `src/hooks/__tests__/useViewer.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useViewer, viewerFrom } from '../useViewer';

describe('viewerFrom', () => {
  it('maps an IS faculty label to a key', () => {
    expect(viewerFrom('PEF', false)).toEqual({ facultyKey: 'pef', erasmus: false });
  });
  it('unknown or missing label is null', () => {
    expect(viewerFrom(null, true)).toEqual({ facultyKey: null, erasmus: true });
    expect(viewerFrom('XYZ', false)).toEqual({ facultyKey: null, erasmus: false });
  });
});

describe('useViewer', () => {
  beforeEach(() => {
    useAppStore.setState({ userFaculty: 'PEF', isErasmus: true, impersonation: null });
  });
  it('is the signed-in student by default', () => {
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({ facultyKey: 'pef', erasmus: true });
  });
  it('is the impersonated student while impersonating, never Erasmus', () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({ facultyKey: 'frrms', erasmus: false });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/hooks/__tests__/useViewer.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** Create `src/hooks/useViewer.ts`:

```ts
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FACULTY_LABEL_TO_KEY } from '../types/events';
import type { Viewer } from '../utils/eventAudience';

export function viewerFrom(facultyLabel: string | null, erasmus: boolean): Viewer {
  return { facultyKey: (facultyLabel && FACULTY_LABEL_TO_KEY[facultyLabel]) || null, erasmus };
}

/**
 * Who the event audience rule is applied to. While a reis_admin impersonates,
 * it is the impersonated student's faculty, so the map and Novinky show what
 * that student would see. The picker cannot impersonate an Erasmus student, so
 * `erasmus` is false then. `userParams` is NOT overlaid by impersonation, which
 * is why this reads the selection itself.
 */
export function useViewer(): Viewer {
  const own = useAppStore((s) => s.userFaculty);
  const erasmus = useAppStore((s) => s.isErasmus);
  const impersonated = useAppStore((s) => s.impersonation?.selection.faculty ?? null);
  return useMemo(
    () => (impersonated ? viewerFrom(impersonated, false) : viewerFrom(own, erasmus)),
    [own, erasmus, impersonated]
  );
}
```

Replace the body of `src/hooks/useVisibleMapEvents.ts`:

```ts
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useViewer } from './useViewer';
import { visibleToStudent } from '../utils/eventAudience';
import type { MapEvent } from '../types/events';

/**
 * The map events this student should be shown — the single seam every surface
 * that displays events goes through (pins, the Akce list, the peek band), so
 * they cannot disagree. Filtered at READ time against who the student is
 * (`useViewer`), because the fetch is anonymous.
 */
export function useVisibleMapEvents(): MapEvent[] {
  const events = useAppStore((s) => s.mapEvents);
  const societies = useAppStore((s) => s.societies);
  const viewer = useViewer();
  return useMemo(() => visibleToStudent(events, societies, viewer), [events, societies, viewer]);
}
```

- [ ] **Step 4: Run it and confirm it passes.** Run `npx vitest run src/hooks/__tests__/useViewer.test.ts`. Expected: PASS.

- [ ] **Step 5: Write the failing cache test.** Create `src/store/slices/__tests__/createContextSlice.viewerCache.test.ts`. It mocks `../../../utils/userParams` (`getUserParams`) and `../../../services/storage` (`IndexedDBService.get/set`) with `vi.mock`, as `createContextSlice.demo.test.ts` does:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));
const getUserParams = vi.fn();
vi.mock('../../../utils/userParams', () => ({ getUserParams: () => getUserParams() }));

import { useAppStore } from '../../useAppStore';

describe('loadContext viewer cache', () => {
  beforeEach(() => {
    idb.clear();
    useAppStore.setState({ userFaculty: null, isErasmus: false, demoMode: false });
  });

  it('remembers faculty and Erasmus once IS names them', async () => {
    getUserParams.mockResolvedValue({ facultyLabel: 'AF', isErasmus: true });
    await useAppStore.getState().loadContext();
    expect(idb.get('viewer_audience')).toEqual({ faculty: 'AF', erasmus: true });
  });

  it('falls back to the remembered audience when IS has not answered (cold start)', async () => {
    idb.set('viewer_audience', { faculty: 'ZF', erasmus: false });
    getUserParams.mockResolvedValue(null);
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userFaculty).toBe('ZF');
  });

  it('does not overwrite the cache with an unparsed faculty', async () => {
    idb.set('viewer_audience', { faculty: 'ZF', erasmus: false });
    getUserParams.mockResolvedValue({ facultyLabel: undefined, isErasmus: false });
    await useAppStore.getState().loadContext();
    expect(idb.get('viewer_audience')).toEqual({ faculty: 'ZF', erasmus: false });
  });
});
```

- [ ] **Step 6: Run it and confirm it fails.** Run `npx vitest run src/store/slices/__tests__/createContextSlice.viewerCache.test.ts`. Expected: FAIL.

- [ ] **Step 7: Implement the cache in `createContextSlice.loadContext`.**
  - Add `import { IndexedDBService } from '../../services/storage';` and `const VIEWER_KEY = 'viewer_audience';`.
  - After the demo guard and before `getUserParams`, add:

```ts
    // Cold start on Capacitor: getUserParams can lose the race with session
    // restore and return nothing, which would leave the event audience unknown
    // (public events only) for the whole session. Follows used to be persisted,
    // which hid this; the remembered audience replaces them. An identity switch
    // wipes IndexedDB (watchSignedInStudent), so this is never another student's.
    if (get().userFaculty === null) {
      const cached = (await IndexedDBService.get('meta', VIEWER_KEY)) as
        | { faculty: string | null; erasmus: boolean }
        | undefined;
      if (cached && get().userFaculty === null) {
        set({ userFaculty: cached.faculty, isErasmus: cached.erasmus });
      }
    }
```

  - Inside `if (params)`, after the `set({...})`, add:

```ts
        if (params.facultyLabel) {
          await IndexedDBService.set('meta', VIEWER_KEY, {
            faculty: params.facultyLabel,
            erasmus: params.isErasmus,
          });
        }
```

  - In the `set({...})`, change `userFaculty: params.facultyLabel ?? null` to `userFaculty: params.facultyLabel ?? get().userFaculty`. An unparsed header must not erase a known faculty.

- [ ] **Step 8: Re-ask after IS lands.**
  - In `src/store/useAppStore.ts`, sync handler (around line 283), replace `st.retryFollowsIfUnresolved();` and its comment with:

```ts
    // A sync only reaches here once IS data has actually landed, which is
    // also the point `getUserParams()` becomes resolvable — so a boot-time
    // `loadContext()` that lost that race gets its real answer here (the
    // event audience depends on it).
    void st.loadContext();
```

  - In `capacitor/startApp.ts`, resume listener, replace the `retryFollowsIfUnresolved` line and its comment with `void useAppStore.getState().loadContext();`.
  - These two edits remove `retryFollowsIfUnresolved` callers before Task 6 deletes it. Keep the action in the follow slice until then.

- [ ] **Step 9: Run the tests.** Run `npx vitest run src/hooks/__tests__/useViewer.test.ts src/store/slices/__tests__/createContextSlice capacitor/__tests__/startApp.test.ts` and `npm run typecheck`. Expected: PASS. If `startApp.test.ts` asserts `retryFollowsIfUnresolved` on resume, change that assertion to `loadContext`.

- [ ] **Step 10: Commit.**
```bash
git add src/hooks/useViewer.ts src/hooks/useVisibleMapEvents.ts src/hooks/__tests__/useViewer.test.ts src/store/slices/createContextSlice.ts src/store/slices/__tests__/createContextSlice.viewerCache.test.ts src/store/useAppStore.ts capacitor/startApp.ts capacitor/__tests__/startApp.test.ts
git commit -m "feat(events): filter the map by the viewer, impersonation and cold start included"
```

### Task 3: Novinky covers 7 days and is filtered by audience

**Files:**
- Modify:
  - `src/components/CampusMap/eventWindow.ts` (add a constant)
  - `src/services/spolky/spolkyService.ts` (select, horizon, delete `filterNotificationsByFaculty`)
  - `src/services/spolky/types.ts` (add `subscribersOnly`)
  - `src/services/spolky/index.ts` (drop the `filterNotificationsByFaculty` export)
  - `src/hooks/useNotificationFeed.ts`
- Test:
  - `src/services/spolky/spolkyService.test.ts`
  - `src/hooks/__tests__/useNotificationFeed.audience.test.ts` (new)

**Interfaces:**
- Consumes: `useViewer` (Task 2), `visibleToStudent` (Task 1).
- Produces:
  - `NOVINKY_WINDOW_DAYS = 7`
  - `dropBeyondNovinkyWindow(list: SpolekNotification[], todayIso: string): SpolekNotification[]`
  - `SpolekNotification.subscribersOnly?: boolean`

- [ ] **Step 1: Write the failing test.** Append to `src/services/spolky/spolkyService.test.ts`:

```ts
import { dropBeyondNovinkyWindow } from './spolkyService';

describe('dropBeyondNovinkyWindow', () => {
  const n = (startsAt?: string) =>
    ({ id: startsAt ?? 'x', title: '', body: '', createdAt: '', expiresAt: '', priority: 'normal', startsAt }) as const;
  it('keeps today through today+6, drops today+7 and later', () => {
    const out = dropBeyondNovinkyWindow(
      [n('2026-10-08'), n('2026-10-14'), n('2026-10-15')],
      '2026-10-08'
    );
    expect(out.map((x) => x.startsAt)).toEqual(['2026-10-08', '2026-10-14']);
  });
  it('keeps undated rows (academic)', () => {
    expect(dropBeyondNovinkyWindow([n(undefined)], '2026-10-08')).toHaveLength(1);
  });
});
```

Create `src/hooks/__tests__/useNotificationFeed.audience.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { useNotificationFeed } from '../useNotificationFeed';
import { localTodayIso } from '../../components/CampusMap/eventWindow';

const today = localTodayIso();
const row = (id: string, associationId: string, subscribersOnly: boolean) => ({
  id, associationId, subscribersOnly, title: id, body: id, createdAt: today,
  expiresAt: today, startsAt: today, priority: 'normal' as const,
});

describe('Novinky audience', () => {
  beforeEach(() => {
    useAppStore.setState({
      societies: Object.fromEntries(BUNDLED_SOCIETIES.map((s) => [s.id, s])),
      userFaculty: 'PEF', isErasmus: false, impersonation: null,
      notifications: {
        ...useAppStore.getState().notifications,
        data: [row('pub', 'au_frrms', false), row('mine', 'supef', true), row('esn', 'esn', true)],
      },
    });
  });
  it('shows public events and my faculty\'s own, without any follow', () => {
    const { result } = renderHook(() => useNotificationFeed());
    expect(result.current.notifications.map((n) => n.id)).toEqual(['pub', 'mine']);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/services/spolky/spolkyService.test.ts src/hooks/__tests__/useNotificationFeed.audience.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`eventWindow.ts`:** below `SOON_WINDOW_DAYS`, add:

```ts
/** Novinky lists the next week only: taps cluster in the week before an event
 *  (production, Oct 2026), and further-out rows drew impressions and no taps. */
export const NOVINKY_WINDOW_DAYS = 7;
```

  - **`types.ts`:** add `subscribersOnly?: boolean;` to `SpolekNotification`, with the comment `/** Restricted to the society's own people (utils/eventAudience). Absent on old caches: public. */`.
  - **`spolkyService.ts`:**
    - Import `NOVINKY_WINDOW_DAYS` instead of `SOON_WINDOW_DAYS`.
    - Add `subscribers_only: z.boolean().nullable().optional()` to `NotificationRowSchema`.
    - Add `subscribers_only` to the `.select(...)` column list.
    - Change the horizon line to `horizon.setDate(horizon.getDate() + NOVINKY_WINDOW_DAYS - 1);`.
    - Map `subscribersOnly: n.subscribers_only ?? false`.
    - Rewrite the comment above the query: the server bound keeps the limit of 200 meaningful.
    - Delete `filterNotificationsByFaculty` and its doc comment.
    - Add:

```ts
/**
 * Drops rows beyond the Novinky week. The server query is bounded the same way,
 * but the feed is also served from `notifications_cache`, which a build with a
 * 14-day window may have written — asking at READ time makes the answer
 * independent of where the list came from. Undated rows (academic) stay.
 */
export function dropBeyondNovinkyWindow(
  notifications: SpolekNotification[],
  todayIso: string
): SpolekNotification[] {
  const last = new Date(`${todayIso}T00:00:00`);
  last.setDate(last.getDate() + NOVINKY_WINDOW_DAYS - 1);
  const lastIso = localTodayIso(last);
  return notifications.filter((n) => !n.startsAt || n.startsAt.slice(0, 10) <= lastIso);
}
```

  - **`index.ts`:** remove `filterNotificationsByFaculty` from the export list.
  - **`useNotificationFeed.ts`:**
    - Replace the `filterNotificationsByFaculty` and `useSpolkySettings` imports with `visibleToStudent` (`../utils/eventAudience`), `useViewer` (`./useViewer`) and `dropBeyondNovinkyWindow` (`../services/spolky/spolkyService`).
    - Read `const societies = useAppStore((s) => s.societies); const viewer = useViewer();`.
    - Import `canSee` from `../utils/eventAudience` (not `visibleToStudent`). Add this above the hook. The old filter always let reIS's own rows through, and this keeps that:

```ts
/** reIS's own rows (admin, academic deadlines) are for everyone, as before. */
const isReisRow = (n: SpolekNotification) =>
  !n.associationId || n.associationId === 'admin' || n.associationId.startsWith('academic_');
```

    - The memo becomes:

```ts
  const notifications = useMemo(
    () =>
      dropScheduledEvents(
        dropBeyondNovinkyWindow(
          dropPastEvents(
            allNotifications.filter(
              (n) =>
                isReisRow(n) ||
                canSee(
                  { societyId: n.associationId ?? '', subscribersOnly: n.subscribersOnly },
                  societies,
                  viewer
                )
            ),
            todayIso
          ),
          todayIso
        )
      ),
    [allNotifications, societies, viewer, todayIso]
  );
```

      (`SpolekNotification` is imported as a type from `../services/spolky/types`.)
    - Remove `settingsLoading`: the interval effect starts unconditionally (`useEffect(() => { const id = setInterval(load, 300000); return () => clearInterval(id); }, [load]);`).
    - Remove `settingsLoading` from the returned object, and update `NotificationFeed.tsx` / `NotificationsSheet.tsx` if they read it. Find them with `grep -rn settingsLoading src`.

- [ ] **Step 4: Run the tests.** Run `npx vitest run src/services/spolky src/hooks/__tests__/useNotificationFeed src/components/NotificationFeed src/components/mobile/sheets/__tests__/NotificationsSheet`. Expected: PASS after fixing tests that mocked `useSpolkySettings` or `filterNotificationsByFaculty`. Delete those mocks; seed `userFaculty` + `societies` in the store instead. Then run `npm run typecheck`.

- [ ] **Step 5: Commit.**
```bash
git add -A src/components/CampusMap/eventWindow.ts src/services/spolky src/hooks src/components/NotificationFeed* src/components/mobile/sheets src/components/Notifications
git commit -m "feat(novinky): next 7 days, filtered by audience instead of follows"
```

### Task 4: Remove RSVP, reminders and the notification plumbing

**Files:**
- Delete:
  - `src/api/eventRsvp.ts`
  - `src/store/slices/createRsvpSlice.ts`, `src/store/slices/rsvpBlockSync.ts`
  - `src/utils/rsvpBlocks.ts`
  - `src/components/CampusMap/EventRsvp.tsx`
  - `src/components/WeeklyCalendar/RsvpBlockPopover.tsx`
  - `src/services/eventReminders/` (whole directory)
  - `src/mobile/reminderTap.ts`, `src/mobile/devNotifyOverride.ts`
  - `src/store/slices/follows/replanNotifications.ts`, `src/store/slices/follows/loadNotifySettings.ts`
  - `src/components/Sidebar/Profile/NotifySettings.tsx`
  - `src/components/mobile/NotifySoftAsk.tsx`
  - **Their tests:**
    - `src/api/__tests__/eventRsvp.test.ts`
    - `src/store/slices/__tests__/createRsvpSlice.test.ts`, `rsvpBlockSync.test.ts`, `withdrawRsvpBlock.test.ts`
    - `src/store/slices/__tests__/replanNotifications*.test.ts`, `createFollowSlice.notifyReadFailed.test.ts`
    - `src/utils/__tests__/rsvpBlocks.test.ts`
    - `src/components/CampusMap/__tests__/EventRsvp.test.tsx`
    - `src/components/WeeklyCalendar/__tests__/RsvpBlockPopover.test.tsx`
    - `src/components/__tests__/CalendarEventCard.rsvpVenue.test.tsx`
    - `src/components/mobile/screens/__tests__/CalendarScreen.rsvpBlock.test.tsx`
    - `src/mobile/__tests__/reminderTap.test.ts`
    - `src/services/eventReminders/__tests__/*`
    - `src/components/Sidebar/Profile/__tests__/NotifySettings.test.tsx`
    - `src/components/mobile/__tests__/NotifySoftAsk.test.tsx`
    - `src/components/Sidebar/Profile/__tests__/SpolkySection.notifications.test.tsx`
  - **Guards:**
    - `src/test/guards/rsvpBlocksWithdrawOnBothTrees.test.ts`
    - `src/test/guards/notificationUiIsPhoneOnly.test.ts`
    - `src/test/guards/reminderTapIsPhoneOnly.test.ts`
- Modify:
  - `src/components/CampusMap/EventDetailCard.tsx`: remove `EventRsvp` and its bordered block; update the header comment ("the facts, and More info").
  - `src/components/CampusMap/MapEventsSection.tsx`: remove `NotifySoftAsk`, `usePhoneViewport` and `isPhone`.
  - `src/components/mobile/sheets/NotificationsSheet.tsx`: remove `NotifySoftAsk`.
  - `src/components/Sidebar/Profile/SpolkySection.tsx`: remove the `notifications` prop, `NotifySettings` and `MuteBell`.
  - `src/components/mobile/screens/ProfileScreen.tsx`: drop the `notifications` prop.
  - `src/store/slices/createFollowSlice.ts`: remove `muted`, `notifyPrefs`, `permissionAsked`, `notifyPermission`, `notifySettingsRead`, `toggleMute`, `setNotifyPref`, `markPermissionAsked`, `setNotifyPermission` and `replanNotifications`, and every call to them. Follow itself stays until Task 6.
  - `src/store/slices/follows/toggleFollow.ts`: drop the replan call.
  - `src/store/slices/createMapSlice.ts:350-359`: delete the `loadRsvps` and `replanNotifications` lines and their comments.
  - `src/store/slices/createI18nSlice.ts:9-13,27,35`: delete the replan calls and the comment.
  - `src/store/useAppStore.ts`: remove the `createRsvpSlice` import and spread, the `devNotifyOverride` import, and the DEV `?notify=` block (lines 134-144).
  - `src/store/types.ts:722`: remove `RsvpSlice`.
  - `capacitor/startApp.ts`:
    - remove the `installReminderTapHandler` import and call (lines 12 and 100-105);
    - remove the `readNotificationPermission` import and both calls (lines 14, 110-114 and 150-152) with their comments.
  - `src/components/WeeklyCalendar/index.tsx`:
    - remove the `RsvpBlockPopover` and `isRsvpBlock` imports, the `openRsvpBlock` state and `rsvpPopover` (both render sites);
    - in `handleEventClick`, `setEditingCustomEvent({ event, anchor })` becomes unconditional.
  - `src/utils/lessonPlace.ts`: new signature `lessonPlace(lesson: BlockLesson, language: string): LessonPlace`, with `LessonPlace = { label: string; onMap: boolean; routable: boolean }`. Delete the event branch, `eventId`, `host` and the `rsvpBlocks` import.
  - **Every `lessonPlace` caller** (`AgendaEvent.tsx`, `NowNextCard.tsx`, `WeekBlock.tsx`, `CalendarEventCard.tsx`): pass only `(lesson, language)`; delete the `mapEvents` / `societies` / `onMapLabel` reads used only for it; the teacher slot is `lesson.teachers[0]?.shortName || lesson.teachers[0]?.fullName`.
  - `src/components/mobile/screens/calendar/useOpenLesson.ts`: `if (lesson.isCustom) return;` and drop the `showOnMap` import if unused.
  - `src/components/mobile/screens/calendar/useShowLessonOnMap.ts`: delete the event branch, the `focusEventById` read and the `rsvpBlocks` import; update the doc comment.
  - `src/utils/customEventLesson.ts:10`: drop the `rsvpBlockSync` mention from the comment.
  - `src/store/slices/admin/loadSocietyPosts.ts`:
    - delete the RSVP fetch (lines 54-64), `setRsvpCounts` and the `RsvpCounts` import;
    - in `createAdminSlice.ts`, delete `societyRsvpCounts` (lines 7, 26, 79, 122, 195, 244).
  - `src/components/AdminConsole/EventStats.tsx`: delete the `interest` branch and the `Users` icon. Task 14 rewrites the rest.
  - `src/test/guards/desktopHasNoShowOnMap.test.ts`: delete the RSVP-block half (lines 41-66 and the `eventIdFromRsvpBlock` references). Keep the lesson half.
  - `privacy/disclosures.ts`:
    - `survey_and_rsvp` → `id: 'survey'`, `what: 'An NPS answer on the random install id.'`, `files: ['src/api/feedback.ts']`, `calls: ['submit_feedback']`, `policyRows: [['In-app survey', 'you answer', 'the same random install identifier']]`. Stores stay as they are.
    - Delete the `get_event_rsvps` EXEMPT entry.
  - `src/test/guards/noStudentDataLeaves.test.ts`: remove `'src/api/eventRsvp.ts'` and its comment from `SUPABASE_CALLERS`; drop the RSVP implicit-consent note in the Firefox-consent test (around lines 351-370).
  - `scripts/appHealth.ts:43-46`: remove `'get_event_rsvps'` from `READ_ONLY_SUPABASE_RPCS`.
  - `PRIVACY.md:63`: drop RSVP from the sentence.
  - i18n `cs.json` / `en.json`: delete the keys used only by deleted components (`map.rsvp*`, `map.interested*`, `notify.*`, `calendar.rsvp*`). Find them with `git grep -n "t('<key>"` before deleting.

**Interfaces:**
- Consumes: nothing new.
- Produces: `lessonPlace(lesson, language): { label; onMap; routable }`. Task 6 relies on the follow slice no longer carrying notification state.

- [ ] **Step 1: Write the failing guard.** Create `src/test/guards/societyEventsStayReduced.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Society events were reduced on purpose (spec 2026-10-08): no RSVP, no attendee
 * counts, no reminders. Students are shown that an event exists, quietly. A
 * returning RSVP call or a scheduled local notification means someone rebuilt
 * what was removed — read the spec before loosening this.
 */
const grep = (pattern: string) => {
  try {
    return execSync(`git grep -n -E "${pattern}" -- src ':!src/test/guards'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
};

describe('society events stay reduced', () => {
  it('no RSVP call', () => {
    expect(grep('set_event_rsvp|get_event_rsvps')).toBe('');
  });
  it('no scheduled local notifications', () => {
    expect(grep('LocalNotifications\\.schedule')).toBe('');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/test/guards/societyEventsStayReduced.test.ts`. Expected: FAIL; it lists `src/api/eventRsvp.ts` and `src/services/eventReminders/sync.ts`.

- [ ] **Step 3: Make the deletions and modifications listed above.** Work in this order, so the tree compiles at the end: card and list first, then slices and boot, calendar, admin, guards and privacy, and i18n last.

- [ ] **Step 4: Run the touched tests.** Run:
```bash
npx vitest run src/test/guards src/components/CampusMap src/components/WeeklyCalendar src/components/mobile/screens src/utils/__tests__/lessonPlace.test.ts src/store/slices src/components/AdminConsole capacitor scripts/lib/__tests__/privacyDisclosures.test.ts scripts/__tests__/appHealth.test.ts src/components/Sidebar
npm run typecheck
```
Expected: PASS. Update `lessonPlace.test.ts`, `AgendaEvent.test.tsx`, `NowNextCard.test.tsx`, `DayBody.customEvent.test.tsx`, `MapSheet.calendarEvent.test.tsx` and `MapSidePanel.test.tsx`: delete the RSVP-block cases and drop the removed arguments.

- [ ] **Step 5: Regenerate the policy table.** Run `npm run privacy:generate`, then `npx vitest run scripts/lib/__tests__/privacyDisclosures.test.ts`. Expected: PASS, with `docs/privacy-policy-app.md` updated.

- [ ] **Step 6: Commit.**
```bash
git add -A
git commit -m "refactor(events): remove RSVP, attendee counts, reminders and the digest"
```

### Task 5: The hidden way into admin

**Files:**
- Create: `src/hooks/ui/useLongPress.ts`
- Modify:
  - `src/components/mobile/screens/profile/ProfileIdentity.tsx`
  - `src/components/Sidebar/ProfilePopup.tsx:49-56`
  - `src/components/mobile/screens/ProfileScreen.tsx`
  - i18n
- Test:
  - `src/hooks/ui/__tests__/useLongPress.test.tsx`
  - `src/components/mobile/screens/__tests__/ProfileScreen.adminEntry.test.tsx`

**Interfaces:**
- Produces: `useLongPress(onLongPress: () => void, ms?: number)`, which returns pointer handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerLeave`, `onPointerCancel`, `onContextMenu`).
- Consumes: the store's `openSocietyAdmin` and `adminSession`.

- [ ] **Step 1: Write the failing test.** Create `src/hooks/ui/__tests__/useLongPress.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

function Probe({ onLong }: { onLong: () => void }) {
  return <div data-testid="t" {...useLongPress(onLong)} />;
}

describe('useLongPress', () => {
  it('fires after 700 ms held', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(699));
    expect(onLong).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onLong).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it('a release or a move cancels it', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(getByTestId('t'));
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(getByTestId('t'), { clientX: 30, clientY: 0 });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/hooks/ui/__tests__/useLongPress.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** Create `src/hooks/ui/useLongPress.ts`:

```ts
import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';

/** Movement past this many CSS px is a scroll or a drag, not a hold. */
const SLOP = 10;

/**
 * A press held for `ms`, by finger or mouse. The hidden door into the admin
 * console (spec 2026-10-08): societies no longer self-post, so the console left
 * Profile, and "hold your name" is easy to tell the few people who need it.
 */
export function useLongPress(onLongPress: () => void, ms = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (e: PointerEvent) => {
      cancel();
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // iOS/Android open a text-selection callout on a held name; the hold is ours.
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
```

- [ ] **Step 4: Run it and confirm it passes.** Run `npx vitest run src/hooks/ui/__tests__/useLongPress.test.tsx`. Expected: PASS.

- [ ] **Step 5: Wire it up on both trees, with a failing test first.** Create `src/components/mobile/screens/__tests__/ProfileScreen.adminEntry.test.tsx`, following the setup of `ProfileScreen.impersonation.test.tsx`. It asserts:
  - (a) holding `getByTestId('profile-identity-name')` for 700 ms calls `openSocietyAdmin`, with a store spy via `useAppStore.setState({ openSocietyAdmin: spy })`;
  - (b) no row labelled "Správa" exists while `adminSession` is null;
  - (c) with `adminSession: {} as never`, a "Správa" row exists, and clicking it calls `openSocietyAdmin`.
  
  Run it and confirm it fails. Then:
  - **`ProfileIdentity.tsx`:** spread `useLongPress(openSocietyAdmin)` on the name/ID column `div` (`flex min-w-0 flex-1 flex-col gap-0.5`). Add `data-testid="profile-identity-name"` and `select-none [-webkit-touch-callout:none]` to its classes. Read `openSocietyAdmin` from the store.
  - **`ProfilePopup.tsx`:** spread the same handlers on the `fullName` row (`div.flex.items-center.gap-3` at line ~52) and add `select-none`. The popover closes after opening: `useLongPress(() => { openSocietyAdmin(); onClose?.(); })`.
  - **`ProfileScreen.tsx`:** next to the impersonation `NavRow`, render

```tsx
          {hasAdminSession && (
            <NavRow icon={ShieldCheck} label={t('admin.entry')} onClick={openSocietyAdmin} />
          )}
```

    with `const hasAdminSession = useAppStore((s) => s.adminSession !== null);`, `openSocietyAdmin` from the store, and `ShieldCheck` from `lucide-react`.
  - **`ProfilePopup.tsx`, inside the Services section:** add the same row as a button styled like the impersonation button beside it, gated on `adminSession !== null`.
  - **i18n:** `admin.entry` is "Správa" / "Admin".

- [ ] **Step 6: Run the tests.** Run `npx vitest run src/hooks/ui src/components/mobile/screens/__tests__/ProfileScreen src/components/Sidebar/__tests__/ProfilePopup.test.tsx` and `npm run typecheck`. Expected: PASS.

- [ ] **Step 7: Commit.**
```bash
git add -A src/hooks/ui src/components/mobile/screens src/components/Sidebar/ProfilePopup.tsx src/i18n/locales
git commit -m "feat(admin): hold your name in Profile to reach the console; Správa row once signed in"
```

### Task 6: Remove follow and the Profile Spolky section

**Files:**
- Delete:
  - `src/store/slices/createFollowSlice.ts`, `src/store/slices/follows/` (the rest of the directory)
  - `src/hooks/useSpolkySettings.ts`
  - `src/components/CampusMap/FollowChip.tsx`
  - `src/components/Sidebar/Profile/SpolkySection.tsx`
  - `src/services/spolky/renamedAssociations.ts`, whose only reader was `loadFollows`
  - **Tests:**
    - `src/store/slices/__tests__/createFollowSlice*.test.ts`, `loadFollowedList.test.ts`
    - `src/hooks/__tests__/useSpolkySettings.test.ts`
    - `src/components/CampusMap/__tests__/FollowChip.test.tsx`
    - `src/components/Sidebar/Profile/__tests__/SpolkySection*.test.tsx`
    - any `renamedAssociations` test
- Modify:
  - `src/components/CampusMap/EventDetailCard.tsx`: remove `FollowChip`; the host line is a single `<span>`.
  - `src/components/mobile/screens/ProfileScreen.tsx`: remove the Spolky heading and `SpolkySection` block (lines 98-112), `useSpolkySettings`, `spolkyOpen`, `setMobileTab` if unused, and the `useState` import if unused; update the doc comment.
  - `src/components/Sidebar/ProfilePopup.tsx`: remove `SpolkySection`, `spolkyOpen` and `useSpolkySettings`.
  - `src/store/useAppStore.ts`: remove the `createFollowSlice` import and spread, and `void s2.loadFollows();` (line 224).
  - `src/store/types.ts:723`: remove `FollowSlice`.
  - `src/components/AdminConsole/SocietyForm.tsx:173-189`: remove the auto-follow checkbox.
  - `src/components/AdminConsole/societyFormRules.ts`: remove `autoFollowHolder`.
  - `src/store/slices/societies/saveSociety.ts`: keep writing `auto_follow_faculty` with the value already on the record (old builds read it); `SocietyForm` passes the existing value through unchanged.
  - `src/utils/diagnostics/diagnosticLog.ts`: drop any follow-specific context names if they are listed.
  - i18n: delete `admin.manageButton`, `mobile.profile.societies`, `map.follow*` and `spolky.*` keys no longer referenced (check with `git grep`).
  - Tests that mocked `useSpolkySettings` (`Sidebar.test.tsx`, `ProfilePopup.test.tsx`, `dropdownExternalLinks.test.tsx`, `useAppLogic.*.test.ts`, `createMenuSlice.test.ts`): delete the mock.
  - `SocietyForm.test.tsx` and `societyFormRules.test.ts`: delete the auto-follow cases.
- Extend `societyEventsStayReduced.test.ts`:

```ts
  it('no follow store', () => {
    expect(grep('reis_subscribed_associations|toggleFollow|useSpolkySettings')).toBe('');
  });
```

- [ ] **Step 1: Run the new guard case and confirm it fails.** Run `npx vitest run src/test/guards/societyEventsStayReduced.test.ts`.
- [ ] **Step 2: Make the deletions and edits above.**
- [ ] **Step 3: Run the tests.** Run `npx vitest run src/test/guards src/components src/store src/hooks` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "refactor(events): remove follow; the audience rule replaces it"
```

### Task 7: One-time device cleanup

**Files:**
- Create: `src/services/cleanup/retireSocietyFeatures.ts`
- Modify: `src/store/useAppStore.ts` (Tier 2, the `loadCalendarCustomEvents` call)
- Test: `src/services/cleanup/__tests__/retireSocietyFeatures.test.ts`

**Interfaces:**
- Produces: `retireSocietyFeatures(deps?: { clearScheduledNotifications: () => Promise<void> }): Promise<void>`, plus the meta key `'retired_society_features_v1'`.

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const stores: Record<string, Map<string, unknown>> = { meta: new Map(), custom_events: new Map() };
vi.mock('../../storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (s: string, k: string) => stores[s]!.get(k)),
    set: vi.fn(async (s: string, k: string, v: unknown) => void stores[s]!.set(k, v)),
    delete: vi.fn(async (s: string, k: string) => void stores[s]!.delete(k)),
    getAllWithKeys: vi.fn(async (s: string) =>
      [...stores[s]!.entries()].map(([key, value]) => ({ key, value }))
    ),
  },
}));

import { retireSocietyFeatures } from '../retireSocietyFeatures';

describe('retireSocietyFeatures', () => {
  beforeEach(() => {
    stores.meta = new Map<string, unknown>([
      ['reis_subscribed_associations', ['supef']],
      ['event_rsvps_mine', {}],
      ['seen_deadline_alerts', ['a']],
      ['read_notifications', ['b']],
    ]);
    stores.custom_events = new Map<string, unknown>([
      ['rsvp:123', {}],
      ['mine-1', {}],
    ]);
  });

  it('removes RSVP blocks and retired keys, keeps everything else, runs once', async () => {
    const clear = vi.fn(async () => {});
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect([...stores.custom_events!.keys()]).toEqual(['mine-1']);
    expect(stores.meta!.has('reis_subscribed_associations')).toBe(false);
    expect(stores.meta!.has('event_rsvps_mine')).toBe(false);
    expect(stores.meta!.get('seen_deadline_alerts')).toEqual(['a']);
    expect(stores.meta!.get('read_notifications')).toEqual(['b']);
    expect(clear).toHaveBeenCalledOnce();
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(clear).toHaveBeenCalledOnce();
  });

  it('a failed notification clear does not mark it done', async () => {
    const clear = vi.fn(async () => {
      throw new Error('plugin');
    });
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(stores.meta!.has('retired_society_features_v1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/services/cleanup`. Expected: FAIL.

- [ ] **Step 3: Implement.** Create `src/services/cleanup/retireSocietyFeatures.ts`:

```ts
import { IndexedDBService } from '../storage';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';

/**
 * Removes what follow, RSVP and the reminders left on a device (spec
 * 2026-10-08). Without it an answered event stays in the timetable as a block
 * nothing can remove (the card's toggle is gone), and 5.3.0's 2-hour reminders
 * still fire. Runs once; a failure leaves it unmarked so the next boot retries.
 * `seen_deadline_alerts`, `read_notifications` and `notifications_cache` are
 * Novinky's and stay.
 */
const DONE_KEY = 'retired_society_features_v1';
const RSVP_BLOCK_PREFIX = 'rsvp:';
const RETIRED_META_KEYS = [
  'event_rsvps_mine',
  'reis_subscribed_associations',
  'reis_associations_chosen',
  'reis_erasmus_auto_subscribed',
  'reis_muted_associations',
  'reis_notify_prefs',
  'reis_notify_asked',
];
const RETIRED_CHANNELS = ['reis-event-reminders', 'reis-society-digest'];

async function clearScheduledNotifications(): Promise<void> {
  if (getPlatform().kind !== 'capacitor') return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  }
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') return;
  for (const id of RETIRED_CHANNELS) await LocalNotifications.deleteChannel({ id });
}

export async function retireSocietyFeatures(
  deps: { clearScheduledNotifications: () => Promise<void> } = { clearScheduledNotifications }
): Promise<void> {
  try {
    if (await IndexedDBService.get('meta', DONE_KEY)) return;
    const blocks = await IndexedDBService.getAllWithKeys('custom_events');
    for (const { key } of blocks) {
      if (String(key).startsWith(RSVP_BLOCK_PREFIX)) {
        await IndexedDBService.delete('custom_events', String(key));
      }
    }
    for (const key of RETIRED_META_KEYS) await IndexedDBService.delete('meta', key);
    await deps.clearScheduledNotifications();
    await IndexedDBService.set('meta', DONE_KEY, true);
  } catch (err) {
    logError('Cleanup.retireSocietyFeatures', err);
  }
}
```

- [ ] **Step 4: Run boot through it.** In `src/store/useAppStore.ts`, Tier 2, replace `s2.loadCalendarCustomEvents();` with:

```ts
    // Before the calendar loads its blocks, so a retired RSVP block is never
    // drawn once (see retireSocietyFeatures). Never rejects.
    void retireSocietyFeatures().finally(() => s2.loadCalendarCustomEvents());
```

Import it directly from `../services/cleanup/retireSocietyFeatures`.

- [ ] **Step 5: Run the tests.** Run `npx vitest run src/services/cleanup src/hooks/__tests__/useAppLogic` and `npm run typecheck`. Expected: PASS. Confirm the content-script graph test still passes; the plugin import is dynamic and the module is iframe-only. Run `npx vitest run src/test/guards/contentScriptGraph`.

- [ ] **Step 6: Commit.**
```bash
git add src/services/cleanup src/store/useAppStore.ts
git commit -m "feat(events): one-time cleanup of RSVP blocks, follow keys and scheduled reminders"
```

### Task 8: Docs, the import skill and the disclosures text

**Files:**
- Modify:
  - `PRIVACY.md`
  - `privacy/disclosures.ts` (the `spolky_events` EXEMPT reason)
  - `src/test/guards/noStudentDataLeaves.test.ts` (the Photon comment)
- Modify, outside the repo: `/Users/Dominik.Holek/Documents/reis/reis-extension/.claude/skills/import-society-events/SKILL.md` (untracked in the main checkout)

- [ ] **Step 1:** In `privacy/disclosures.ts`, set the `spolky_events` EXEMPT `why` to `'Public society feed reads; writes are by reIS staff or a society login, never a student.'`. Then run `npx vitest run scripts/lib/__tests__/privacyDisclosures.test.ts`. Expected: PASS.
- [ ] **Step 2:** In `PRIVACY.md`, line 69, the Photon sentence says "only by reIS staff and society logins in the admin console". Run `npx vitest run src/test/guards` to catch line-sensitive guards (see memory "policy guard tests after doc edits").
- [ ] **Step 3:** In the import skill, replace the followers-only wording. The question becomes: "For everyone, or only for <society>'s own people (<FACULTY> students / Erasmus students)?" `subscribers_only = true` now means the faculty or Erasmus audience. For `reis`, never ask.
- [ ] **Step 4: Commit the repo files.**
```bash
git add PRIVACY.md privacy/disclosures.ts docs/privacy-policy-app.md src/test/guards
git commit -m "docs(privacy): society events no longer have RSVP; writes are by reIS staff"
```

### Task 9: Verify the UI on both trees

- [ ] **Step 1:** Load the `verify-ui` skill and follow it. Use `npm run dev:web` with the snapshot and seed events: one public, one restricted to PEF, one ESN-restricted.
- [ ] **Step 2: Phone tree at 320/390/430 and tablet (834):**
  - Map Akce list (no soft-ask card), peek band, event card (no Sledovat, no "Mám zájem").
  - Profile: no Spolky section; holding the name opens the console; the Správa row appears once signed in.
  - Novinky: only ≤7 days, public plus own faculty.
  - Calendar: no RSVP blocks.
- [ ] **Step 3: Desktop tree:** map side panel, detail card, ProfilePopup (hold the name), the Novinky dropdown.
- [ ] **Step 4: Impersonation:** with `npm run dev:web:admin` (if credentials exist; otherwise the dev seed), impersonate an FRRMS programme. The map and Novinky show the FRRMS-restricted event and hide the PEF one.
- [ ] **Step 5:** Both themes. Send before/after PNGs with `SendUserFile`. Measure the absence of overflow (the skill's assertions), not just how screenshots look.

### Task 10: Open PR 1

- [ ] **Step 1:** `git push personal claude/society-events-redesign-54f4bf` (push identity per memory).
- [ ] **Step 2:** Open the PR against `test` with `gh pr create --base test`. The body covers:
  - the spec link and the production numbers;
  - "old builds keep RSVP/follow until updated";
  - "no release from test until PR 2 lands";
  - a checklist for the device test: iOS + Android release builds, an RSVP block present before the update and gone after, no reminder firing.
  
  End the body with the attribution line. Enable Auto-fix. **Do not merge**: Dominik approves the merge.

---

# PR 2: Counters

Branch `claude/society-events-signals` from PR 1's head. Open it against `test` only after PR 1 merges.

### Task 11: Migration for the three counters and the reader

**Files:**
- Create: `supabase/migrations/20261009120000_event_signals.sql`

- [ ] **Step 1: Write the migration.**

```sql
-- Three per-event numbers for the admin console (spec 2026-10-08): Seen,
-- Opened, Link tapped. Each counted once per DEVICE by the client, which keeps
-- its own record of what it already sent; the server receives an event id and
-- nothing else, rolled up per event per day. `views` stays for old builds'
-- once-per-session opens and is not displayed — mixing the two would make the
-- numbers mean nothing.
alter table public.event_map_views
  add column if not exists seen      integer not null default 0,
  add column if not exists opened    integer not null default 0,
  add column if not exists link_taps integer not null default 0,
  alter column views set default 0;

create or replace function public.increment_event_signal(row_id uuid, signal text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if signal not in ('seen', 'opened', 'link') then
    return;
  end if;
  insert into public.event_map_views (event_id, view_date, views, seen, opened, link_taps)
  values (row_id, current_date, 0,
          (signal = 'seen')::int, (signal = 'opened')::int, (signal = 'link')::int)
  on conflict (event_id, view_date) do update set
    seen      = public.event_map_views.seen      + (signal = 'seen')::int,
    opened    = public.event_map_views.opened    + (signal = 'opened')::int,
    link_taps = public.event_map_views.link_taps + (signal = 'link')::int;
exception
  when foreign_key_violation then
    return;
end;
$$;

revoke all on function public.increment_event_signal(uuid, text) from public;
grant execute on function public.increment_event_signal(uuid, text) to anon, authenticated;

-- Totals per event, for reis_admin or the society that owns the event.
create or replace function public.event_signals(p_event_ids uuid[])
returns table (event_id uuid, seen bigint, opened bigint, link_taps bigint)
language sql stable security definer set search_path = '' as $$
  select v.event_id, sum(v.seen), sum(v.opened), sum(v.link_taps)
  from public.event_map_views v
  join public.spolky_events e on e.id = v.event_id
  where v.event_id = any(p_event_ids)
    and (coalesce(public.get_my_role(), '') = 'reis_admin'
         or e.association_id = public.get_my_association())
  group by v.event_id;
$$;

revoke all on function public.event_signals(uuid[]) from public, anon;
grant execute on function public.event_signals(uuid[]) to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Dry-run against production in a self-unwinding block.** See memory "migrations do not self-apply". Wrap the file body in `begin; … rollback;` in a scratchpad copy. Run `npx supabase db query --linked -f <scratch>.sql`. Expected: no error. Before applying, check `views set default 0` against old builds: `increment_event_map_view` writes `views` explicitly (`values (row_id, current_date, 1)`), so the default change cannot affect it.
- [ ] **Step 3: Commit.** Apply to production only when Dominik approves PR 2, and before the release.
```bash
git add supabase/migrations/20261009120000_event_signals.sql
git commit -m "feat(db): per-event seen/opened/link counters and a society-scoped reader"
```

### Task 12: Client writer with per-device dedupe

**Files:**
- Create: `src/api/eventSignals.ts`
- Modify:
  - `src/api/featureUsage.ts`: delete `trackMapEventView`, `viewedEvents`, its reset line, and the event half of the header comment.
  - `privacy/disclosures.ts`
  - `src/test/guards/noStudentDataLeaves.test.ts`
- Test: `src/api/__tests__/eventSignals.test.ts`; delete the map-view cases in `featureUsage.test.ts` and `featureUsage.live.test.ts`.

**Interfaces:**
- Produces:
  - `export type EventSignal = 'seen' | 'opened' | 'link'`
  - `trackEventSignal(eventId: string, signal: EventSignal): Promise<void>`
  - `__resetEventSignalsForTests(): void`
  - meta key `'event_signal_sent'` holding a `string[]` of `"<signal>:<id>"`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const meta = new Map<string, unknown>();
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => meta.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void meta.set(k, v)),
  },
}));
const rpc = vi.fn(async () => ({ error: null }));
vi.mock('../../services/spolky/supabaseClient', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('../../utils/firefoxDataConsent', () => ({ hasDataConsent: async () => true }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => false }));
vi.mock('../../utils/harnessEnabled', () => ({ isHarnessEnabled: () => false }));

import { trackEventSignal, __resetEventSignalsForTests } from '../eventSignals';

describe('trackEventSignal', () => {
  beforeEach(() => {
    meta.clear();
    rpc.mockClear();
    __resetEventSignalsForTests();
  });
  it('sends the event id and the signal, nothing else', async () => {
    await trackEventSignal('e1', 'seen');
    expect(rpc).toHaveBeenCalledWith('increment_event_signal', { row_id: 'e1', signal: 'seen' });
  });
  it('once per device per event per signal, across restarts', async () => {
    await trackEventSignal('e1', 'opened');
    __resetEventSignalsForTests(); // a new session, same IndexedDB
    await trackEventSignal('e1', 'opened');
    await trackEventSignal('e1', 'link');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('a failed write is retried next time', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'x' } } as never);
    await trackEventSignal('e2', 'seen');
    await trackEventSignal('e2', 'seen');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/api/__tests__/eventSignals.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Create `src/api/eventSignals.ts`:

```ts
import { supabase } from '../services/spolky/supabaseClient';
import { IndexedDBService } from '../services/storage';
import { isDemoMode } from '../errors/demoMode';
import { isHarnessEnabled } from '../utils/harnessEnabled';
import { hasDataConsent } from '../utils/firefoxDataConsent';
import { logError } from '../utils/reportError';

/**
 * The three numbers an event carries in the admin console: Seen (on screen in
 * the Akce list, the peek band, a pin or Novinky), Opened (its card), Link
 * (Instagram / more info). Each is sent at most once per DEVICE per event —
 * the record of what was sent stays here in IndexedDB, so the server gets an
 * event id and nothing else, and never learns which device looked at what.
 */
export type EventSignal = 'seen' | 'opened' | 'link';

const KEY = 'event_signal_sent';
let sent: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

async function loadSent(): Promise<Set<string>> {
  if (sent) return sent;
  loading ??= IndexedDBService.get('meta', KEY).then((v) => {
    sent = new Set(Array.isArray(v) ? (v as string[]) : []);
    return sent;
  });
  return loading;
}

export function __resetEventSignalsForTests(): void {
  sent = null;
  loading = null;
}

export async function trackEventSignal(eventId: string, signal: EventSignal): Promise<void> {
  if (isDemoMode() || isHarnessEnabled(import.meta.env)) return;
  const mark = `${signal}:${eventId}`;
  try {
    const record = await loadSent();
    if (record.has(mark)) return;
    record.add(mark);
    if (!(await hasDataConsent('technicalAndInteraction'))) {
      record.delete(mark);
      return;
    }
    const { error } = await supabase.rpc('increment_event_signal', { row_id: eventId, signal });
    if (error) {
      record.delete(mark);
      logError('Api.trackEventSignal', new Error(error.message));
      return;
    }
    await IndexedDBService.set('meta', KEY, [...record]);
  } catch (err) {
    sent?.delete(mark);
    logError('Api.trackEventSignal', err);
  }
}
```

- [ ] **Step 4: Run it and confirm it passes.** Run `npx vitest run src/api/__tests__/eventSignals.test.ts`. Expected: PASS.

- [ ] **Step 5: Disclosures.**
  - In `privacy/disclosures.ts`, replace the `map_event_views` flow with two flows:
    - `id: 'event_interaction'`:
      - `what: 'An open or link tap on a society event, once per device; the event id and no identifier.'`
      - `when: 'student-action'`, `identifier: 'none'`
      - `files: ['src/api/eventSignals.ts']`, `calls: ['increment_event_signal']`
      - `policyRows: [['Society event opened or link tapped', 'you open an event or its link', "that event's id and nothing else"]]`
      - `stores: { apple: [], play: [], firefox: ['technicalAndInteraction'], cws: [] }`
    - `id: 'event_seen'`:
      - `what: 'A society event shown on screen, once per device; the event id and no identifier.'`
      - `when: 'background'`, `identifier: 'none'`
      - same `files` and `calls`
      - `policyRows: [['Society event shown', 'an event appears on your screen', "that event's id and nothing else"]]`
      - same stores
  - Add `src/api/eventSignals.ts` to `SUPABASE_CALLERS` in `noStudentDataLeaves.test.ts`. Use the justification: "Event id only, no identifier; once per device recorded locally (spec 2026-10-08). Replaces increment_event_map_view."
  - Remove the `increment_event_map_view` note from the `featureUsage.ts` entry.
  - Add `'src/api/eventSignals.ts'` to the guard's Firefox-consent gated list.
  - If the checker requires one flow per call, keep a single flow and put both policy rows in it.
  - Run `npm run privacy:generate`, then `npx vitest run scripts/lib/__tests__/privacyDisclosures.test.ts src/test/guards/noStudentDataLeaves.test.ts src/api`. Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add -A src/api privacy docs/privacy-policy-app.md src/test/guards
git commit -m "feat(events): once-per-device event signals with no identifier"
```

### Task 13: Send the signals from every surface

**Files:**
- Create:
  - `src/hooks/ui/useSeenSignal.ts`
  - `src/components/CampusMap/usePinsSeen.ts`
- Modify:
  - `src/store/slices/createMapSlice.ts` (`focusEventById`)
  - `src/components/CampusMap/EventLayer.tsx`
  - `src/components/CampusMap/MapEventsSection.tsx`
  - `src/components/CampusMap/EventRow.tsx`
  - `src/components/mobile/screens/map/MapSheetPeek.tsx`
  - `src/components/CampusMap/EventDetailCard.tsx`
  - `src/store/slices/createNotificationSlice.ts`
  - `src/hooks/useOpenNotification.ts`
  - `src/services/spolky/spolkyService.ts`
  - `src/services/spolky/index.ts`
  - `privacy/disclosures.ts`
- Test:
  - `src/hooks/ui/__tests__/useSeenSignal.test.tsx`
  - `src/store/slices/__tests__/createMapSlice.openedSignal.test.ts`
  - `src/components/CampusMap/__tests__/usePinsSeen.test.ts`

**Interfaces:**
- Consumes: `trackEventSignal` (Task 12).
- Produces:
  - `useSeenSignal<T extends Element>(eventId: string | null): (el: T | null) => void`, a ref callback
  - `usePinsSeen(groups: VenueGroup[], enabled: boolean): void`

- [ ] **Step 1: Write the failing tests.**
  - `useSeenSignal.test.tsx` mocks `../../../api/eventSignals` and a fake `IntersectionObserver`. It asserts that an element reported intersecting calls `trackEventSignal(id, 'seen')` once, and that `null` sends nothing.
  - `createMapSlice.openedSignal.test.ts` asserts:
    - `focusEventById(id)` on the student map calls `trackEventSignal(id, 'opened')`;
    - with `adminConsoleOpen: true` it does not;
    - an unknown id does not.
  - `usePinsSeen.test.ts` uses a fake map from `subscribeMapInstance` with `getBounds().contains`. It asserts:
    - only events of groups inside the bounds are sent;
    - nothing is sent when `enabled` is false.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement.**

`src/hooks/ui/useSeenSignal.ts`:

```ts
import { useCallback, useRef } from 'react';
import { trackEventSignal } from '../../api/eventSignals';

/** Seen = at least half of the element on screen, once (eventSignals dedupes per device). */
export function useSeenSignal<T extends Element>(eventId: string | null) {
  const observer = useRef<IntersectionObserver | null>(null);
  return useCallback(
    (el: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || !eventId) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            void trackEventSignal(eventId, 'seen');
            obs.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      observer.current = obs;
    },
    [eventId]
  );
}
```

`src/components/CampusMap/usePinsSeen.ts`:

```ts
import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { subscribeMapInstance } from './mapInstance';
import { trackEventSignal } from '../../api/eventSignals';
import type { VenueGroup } from './eventHelpers';

/**
 * A pin counts as Seen when it is inside the visible map bounds on the student
 * map in campus overview — checked when the camera settles and when the pins
 * change. Not while authoring and not inside a building (the caller passes
 * `enabled`). The map is only mounted while its tab/view is shown.
 */
export function usePinsSeen(groups: VenueGroup[], enabled: boolean): void {
  const state = useRef({ groups, enabled });
  state.current = { groups, enabled };
  const check = useRef<(() => void) | null>(null);

  useEffect(() => {
    let map: L.Map | null = null;
    const run = () => {
      const { groups: gs, enabled: on } = state.current;
      if (!map || !on) return;
      const bounds = map.getBounds();
      for (const g of gs) {
        if (bounds.contains([g.coord[1], g.coord[0]])) {
          for (const e of g.events) void trackEventSignal(e.id, 'seen');
        }
      }
    };
    check.current = run;
    const unsub = subscribeMapInstance((m) => {
      map?.off('moveend', run);
      map = m;
      map?.on('moveend', run);
      run();
    });
    return () => {
      map?.off('moveend', run);
      unsub();
      check.current = null;
    };
  }, []);

  useEffect(() => {
    check.current?.();
  }, [groups, enabled]);
}
```

(Check the `VenueGroup` field names in `eventHelpers.ts`, `coord` and `events`, and adjust if they differ.)

Wire-up:
- **`createMapSlice.focusEventById`:** after the `!event` guard, add `if (!get().adminConsoleOpen) void trackEventSignal(id, 'opened');` with the comment `// Opened is counted here, where every surface opens an event (pin, list, peek band, Novinky), so none is missed.` Import it from `../../api/eventSignals`.
- **`EventLayer.tsx`:**
  - delete the `trackMapEventView` import and the `selectEvent` wrapper and its comment; use `focusEvent` directly where `selectEvent` was passed;
  - add `usePinsSeen(groups, !authoring && activeBuildingId === null);` after `groups`;
  - import from `./usePinsSeen`.
- **`MapEventsSection.tsx`:** delete the `trackMapEventView` import and call; the row `onClick` is `() => focusEvent(e.id, { fly: true })`.
- **`EventRow.tsx`:**
  - add an optional prop `seenRef?: (el: HTMLDivElement | null) => void` and attach it to the root `div`;
  - in `MapEventsSection`, wrap each row in a small `SeenEventRow` component (same file, below `MapEventsSection`) that calls `useSeenSignal<HTMLDivElement>(e.id)` and passes it as `seenRef`;
  - the admin list passes nothing.
- **`MapSheetPeek.tsx`:** `const seenRef = useSeenSignal<HTMLSpanElement>(next?.id ?? null);` above the early returns; attach it to the title `<span>` of the event branch.
- **`EventDetailCard.tsx`:** on the details `<a>`, add `onClick={() => void trackEventSignal(event.id, 'link')}` with the comment `// Counting only; installExternalLinkHandler still opens it (no second open).`
- **`createNotificationSlice.markNotificationViewed`:**
  - replace `await trackNotificationsViewed([id]);` with `await trackEventSignal(id, 'seen');`;
  - delete the `viewedIds` IndexedDB write and the `viewed_notifications_analytics` load in `loadNotificationState`, and instead call `void IndexedDBService.delete('meta', 'viewed_notifications_analytics')` once there;
  - keep `viewedIds` in memory to avoid re-observing.
- **`useOpenNotification.ts`:** delete `track()` and the `trackNotificationClick` import. The tap opens the card, and `focusEventById` counts Opened. A tap on a URL row sends nothing.
- **`spolkyService.ts`:** delete `trackNotificationsViewed` and `trackNotificationClick`, and the `hasDataConsent` import if it is unused. In `index.ts`, drop both exports.
- **`privacy/disclosures.ts`:** delete the `society_post_counters` flow. In `noStudentDataLeaves.test.ts`, change the `spolkyService.ts` comment to "Reads the public society events for Novinky; writes nothing".
- **Extend the guard:** `it('no Novinky post counters', () => expect(grep('increment_post_view|increment_post_click|increment_event_map_view')).toBe(''))`.

- [ ] **Step 4: Run the tests.**
```bash
npx vitest run src/hooks/ui src/store/slices src/components/CampusMap src/components/mobile/screens/map src/components/Notifications src/components/NotificationFeed src/services/spolky src/test/guards scripts/lib/__tests__/privacyDisclosures.test.ts
npm run privacy:generate
npm run typecheck
```
Expected: PASS. Update `NotificationFeed.clicks.test.tsx`, which asserted `increment_post_click`, to assert that `focusEventById` was called.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat(events): count seen, opened and link once per device on every surface"
```

### Task 14: The admin's three numbers; remove "top events"

**Files:**
- Create: `src/api/eventSignalsAdmin.ts`
- Modify:
  - `src/store/slices/admin/loadSocietyPosts.ts`
  - `src/store/slices/createAdminSlice.ts`
  - `src/components/AdminConsole/EventStats.tsx`
  - `src/components/AdminConsole/FeatureSignals.tsx`
  - `src/api/featureStats.ts`
  - `privacy/disclosures.ts` (EXEMPT)
  - `scripts/appHealth.ts`
  - i18n
- Test:
  - `src/api/__tests__/eventSignalsAdmin.test.ts`
  - `src/components/AdminConsole/__tests__/AdminEventStats.test.tsx` (rewrite)
  - `src/store/slices/admin/__tests__/loadSocietyPosts.test.ts`
  - `FeatureSignals.test.tsx`

**Interfaces:**
- Produces:
  - `export interface EventSignalTotals { seen: number; opened: number; linkTaps: number }`
  - `fetchEventSignals(ids: string[]): Promise<{ totals: Record<string, EventSignalTotals>; ok: boolean }>`
  - store field `societyEventSignals: Record<string, EventSignalTotals>`
  - access `setSignals`

- [ ] **Step 1: Write the failing tests.**
  - `eventSignalsAdmin.test.ts`:
    - mock `@/services/admin/authClient` (`adminAuthClient.rpc`);
    - assert it calls `event_signals` with `{ p_event_ids: ids }`;
    - assert it fills zeros for ids with no row and maps `link_taps` to `linkTaps`;
    - assert it returns `ok: false` on error.
  - `AdminEventStats.test.tsx`:
    - with `societyEventSignals: { e1: { seen: 40, opened: 12, linkTaps: 3 } }`, the row reads "40 zobrazení · 12 otevření · 3 odkaz";
    - with none, it renders nothing;
    - `EventStatsNote` renders the "od října 2026" key text.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement.** `src/api/eventSignalsAdmin.ts`:

```ts
import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

export interface EventSignalTotals {
  seen: number;
  opened: number;
  linkTaps: number;
}

const Row = z.object({
  event_id: z.string(),
  seen: z.coerce.number(),
  opened: z.coerce.number(),
  link_taps: z.coerce.number(),
});

/** Totals per event, scoped server-side to reis_admin or the owning society. */
export async function fetchEventSignals(
  ids: string[]
): Promise<{ totals: Record<string, EventSignalTotals>; ok: boolean }> {
  const totals: Record<string, EventSignalTotals> = {};
  for (const id of ids) totals[id] = { seen: 0, opened: 0, linkTaps: 0 };
  if (ids.length === 0 || DEV_SOCIETY) return { totals, ok: true };
  const { data, error } = await adminAuthClient.rpc('event_signals', { p_event_ids: ids });
  if (error) {
    logError('Api.fetchEventSignals', error);
    return { totals, ok: false };
  }
  for (const raw of (data ?? []) as unknown[]) {
    const r = Row.safeParse(raw);
    if (!r.success) continue;
    totals[r.data.event_id] = { seen: r.data.seen, opened: r.data.opened, linkTaps: r.data.link_taps };
  }
  return { totals, ok: true };
}
```

- **`loadSocietyPosts.ts`:**
  - add `setSignals: (totals: Record<string, EventSignalTotals>) => void` to `LoadSocietyPostsAccess`;
  - after `refreshSocietyMapEvents()`, add:

```ts
  // Detached: publish/delete await this action, and slow numbers must not hold
  // up "Uloženo". The guard drops a superseded answer.
  void fetchEventSignals(posts.map((p) => p.id)).then(({ totals, ok }) => {
    if (ok && current()) access.setSignals(totals);
  });
```

  (DEV_SOCIETY is handled inside the fetch.) Update the doc comment.
- **`createAdminSlice.ts`:**
  - add `societyEventSignals: Record<string, EventSignalTotals>`, initialised to `{}`;
  - clear it everywhere `societyPosts` is cleared (lines ~122, ~195);
  - add `setSignals: (totals) => set({ societyEventSignals: totals })` to the access object.
- **`EventStats.tsx`:** rewrite.

```tsx
import { Eye, MousePointerClick, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Seen · Opened · Link tapped for one event, each once per DEVICE (eventSignals
// dedupes locally; the server gets an event id and nothing else). Counted from
// the October 2026 release on — older view/click numbers measured something
// else (every Novinky tap) and are not shown.
export function EventStats({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const s = useAppStore((st) => st.societyEventSignals[eventId]);
  if (!s) return null;
  const item = (Icon: typeof Eye, key: string, count: number) => (
    <span className="flex items-center gap-1">
      <Icon size={11} className="flex-shrink-0" aria-hidden />
      <span>{t(key, { count })}</span>
    </span>
  );
  return (
    <span className="mt-0.5 flex items-center gap-2.5 text-[11px] text-base-content/70">
      {item(Eye, 'admin.eventSeen', s.seen)}
      {item(MousePointerClick, 'admin.eventOpened', s.opened)}
      {item(ExternalLink, 'admin.eventLinkTaps', s.linkTaps)}
    </span>
  );
}

export function EventStatsNote({ eventIds }: { eventIds: string[] }) {
  const { t } = useTranslation();
  const any = useAppStore((st) => eventIds.some((id) => st.societyEventSignals[id]));
  if (!any) return null;
  return <p className="px-3 pb-4 pt-3 text-[11px] text-base-content/70">{t('admin.eventStatsNote')}</p>;
}
```

- **i18n:**
  - `admin.eventSeen` "{count} zobrazení" / "{count} seen"
  - `admin.eventOpened` "{count} otevření" / "{count} opened"
  - `admin.eventLinkTaps` "{count}× odkaz" / "{count} link taps"
  - `admin.eventStatsNote` "Každé číslo počítá jedno zařízení jednou, od října 2026." / "Each number counts a device once, since October 2026."
  - Delete `admin.eventViews*`, `admin.eventClicks*`, `admin.eventInterest`, `admin.stats.topEvents`, `admin.stats.mapViews`, `admin.stats.mapViewsNote`.
- **`FeatureSignals.tsx`:**
  - delete the top-events `<section>`, the `eventId` state, `activeEvent` and `eventSeries`;
  - update the doc comment ("The three feature counters, each row a selector for its trend").
- **`featureStats.ts`:** remove `topEvents` and `eventDaily` from `FeatureStats`, `EMPTY` and the mapping, and `top_events` / `event_daily` from the schema (zod strips unknown keys).
- **`privacy/disclosures.ts` EXEMPT:** add `{ call: 'event_signals', files: ['src/api/eventSignalsAdmin.ts'], why: 'Admin console read, signed-in reis_admin or the owning society.' }`.
- **`scripts/appHealth.ts`:** add `'event_signals' /* read-only aggregate */` to `READ_ONLY_SUPABASE_RPCS`.

- [ ] **Step 4: Run the tests.** Run `npx vitest run src/api src/components/AdminConsole src/store/slices scripts/__tests__/appHealth.test.ts scripts/lib/__tests__/privacyDisclosures.test.ts src/test/guards` and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat(admin): seen, opened and link per event; drop the top-events block"
```

### Task 15: Verify, open PR 2, apply the migration

- [ ] **Step 1: Verify with `verify-ui`.**
  - Admin console on desktop and phone: the event list shows the three numbers and the note; the stats tab has no top events.
  - In the student app (dev, consent on), Network shows `increment_event_signal` with `{ row_id, signal }` only: once for seen, once for opened, once for link. A reload sends none again.
- [ ] **Step 2: CLAUDE.md, "What reIS still sends".** Rewrite item 5 to cover the event signals: Seen / Opened / Link per event per day, no identifier, once per device recorded locally. Item 3, the society post counters, is no longer sent by current builds; say "old builds only".
- [ ] **Step 3: Push.** Push the branch and open it with `gh pr create --base test` after PR 1 has merged. The body includes the migration and the dry-run result. Enable Auto-fix.
- [ ] **Step 4: Apply the migration.** Once Dominik approves the merge, apply it with `npx supabase db query --linked -f supabase/migrations/20261009120000_event_signals.sql`. Then verify through the public API: anon `increment_event_signal` returns 204, and anon `event_signals` returns 401/42501.
