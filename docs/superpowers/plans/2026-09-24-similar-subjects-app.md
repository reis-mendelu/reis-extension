# Similar-subject suggestions (app side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a subject has no success rates, the Úspěšnost tab says so honestly. If reis-data has `similar/<CODE>.json`, it lists up to three similar old subjects with the reasons they were offered, and lets the student preview one under a banner naming the other subject.

**Architecture:**
- **Data.** A schema and a fetcher in `src/api/`. A new Zustand slice, persisted in the IndexedDB `meta` store and stamped with the reis-data version like success rates. The success-rate slice triggers it when a subject comes back without stats.
- **UI.** `SuccessRateTab` becomes a three-state router. Today's chart body moves, unchanged, into `SuccessRate/SuccessRateView.tsx` so a preview renders exactly what a subject's own tab would.
- **Why a preview can't leak.** It loads stats under the OLD code, so the new code's badges and insights never show borrowed numbers.

**Tech Stack:** React 19, Zustand slices, zod, DaisyUI/Tailwind, vitest with Testing Library and fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-24-similar-subject-success-rates-design.md`, §2–§4.

**Companion plan:** `reis-scraper` → `docs/superpowers/plans/2026-09-24-similar-subjects-scraper.md`, on branch `claude/similar-subjects`, which writes the files this reads. Either can ship first.

## Global Constraints

- **Both trees.** `SuccessRateTab` is mounted by `DrawerTabBody` for the extension drawer *and* the phone sheet (`SubjectDrawerSheet` / `SubjectDrawerScroller`), which the iPad also runs. Every file here is shared, so no guard in `src/test/guards/` is needed. Verify all three shells anyway (Task 4).
- **A preview belongs to the subject it was opened for.** The desktop drawer reuses `SuccessRateTab` when the student switches subject, and two new subjects can offer the same old one (ZABAH and ZABIHY both offer KLI). So the preview state records its course code and is ignored for any other. There's a test for it.
- **Never attribute an old subject's numbers to the new code.** `successRates[newCode]` stays empty through a preview. The pass-rate badges, semester insights and `AttemptBadge` read that key.
- **No new transmission.** The one new request is a public CDN file keyed by a subject code already sent for `subjects/<code>.json`. No Supabase caller. `src/test/guards/noStudentDataLeaves.test.ts` must pass unmodified.
- **Iron rules:**
  - no `localStorage` (persist in IndexedDB `meta`);
  - no `useEffect` fetch in components (the store triggers it);
  - DaisyUI classes only;
  - each file under 200 lines;
  - direct imports.
- **The nuia ratchet is per file.** `SuccessRateTab.tsx` is in `nuia-baseline.json`, and moving its body out makes it clean, so it must leave the baseline in the same commit. The new `SuccessRateView.tsx` must be clean, hence `stats[sIdx]!`.
- **Copy (Czech):**
  - "Zatím bez výsledků" / "Pro tento předmět zatím nemáme žádné výsledky." It must never claim "new subject": the app only knows that the file is missing.
  - "Podobné předměty z minulých let"; "Náhled jiného předmětu"; "dříve zápočet, nyní zkouška" / "dříve zkouška, nyní zápočet"; "naposledy {year}".
- **Locally:** run the touched tests and `npm run typecheck`. Leave repo-wide lint, format and the full test run to CI (CLAUDE.md). Exception: this plan changes `nuia-baseline.json`, so run `npm run nuia:gate` too.

## Proven 2026-09-24

Every code block below ran in a throwaway worktree at `11c896d3`, and was then re-applied from this plan's text to a fresh checkout and run again:
- 15 new tests green, alongside the existing `successRateFreshness` and `studyPlanSuccessRates` tests;
- `npm run typecheck`, `nuia:gate`, and ESLint `--max-warnings=0` clean, and Prettier clean on every touched file;
- rendered on the phone tree with the scraper's real output for a B-RASZ first-year's 7 subjects (screenshots in the session).

The tests were also broken on purpose: removing the store trigger fails "asks for similar subjects when the subject has no stats".

## File structure

| File | Responsibility |
|---|---|
| `src/types/schemas/similarSubjects.schema.ts` | zod schema and the `SimilarSuggestion` type. Structural: unknown reasons are kept. |
| `src/api/similarSubjects.ts` | `fetchSimilarSubjects(code)`: a 404 gives `[]`, a malformed file throws. |
| `src/store/slices/createSimilarSubjectsSlice.ts` | State, IndexedDB persistence, version stamping, errors routed to `logError`. |
| `src/store/slices/createSuccessRateSlice.ts` | Modify: the trigger on no stats. |
| `src/store/types.ts`, `src/store/useAppStore.ts`, `src/services/storage/keys.ts` | Modify: slice type, composition, storage key. |
| `src/components/SuccessRate/SuccessRateView.tsx` | Today's chart body, moved and taking `semesters` as a prop. |
| `src/components/SuccessRate/similarLabels.ts` | Pure label logic: known reasons, the completion-change key, the stale year. |
| `src/components/SuccessRate/SimilarSubjectsList.tsx` | The suggestion cards. |
| `src/components/SuccessRate/PreviewBanner.tsx` | The banner above a preview. |
| `src/components/SuccessRateTab.tsx` | The three-state router, plus the internal `SimilarPreview`. |
| `src/i18n/locales/{cs,en}.json` | New `successRate.*` keys. |
| `nuia-baseline.json` | Drop `src/components/SuccessRateTab.tsx`. |

---

### Task 1: Schema and fetcher

**Files:**
- Create: `src/types/schemas/similarSubjects.schema.ts`, `src/api/similarSubjects.ts`
- Test: `src/types/schemas/__tests__/similarSubjects.schema.test.ts`

**Interfaces:**
- Consumes: `CDN_BASE_URL` from `src/api/successRate.ts`.
- Produces:
  - `SimilarSuggestion` (`{ code; nameCs; nameEn; reasons: string[]; completion: 'exam' | 'credit' | null; completionChanged: boolean; lastYear: number | null }`)
  - `SimilarSuggestionSchema`, `SimilarFileSchema`
  - `fetchSimilarSubjects(courseCode: string): Promise<SimilarSuggestion[]>`
  - `MAX_SIMILAR = 3`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SimilarFileSchema } from '../similarSubjects.schema';

const ok = {
  courseCode: 'EKOE1',
  generatedAt: '2026-09-24T12:00:00Z',
  suggestions: [
    {
      code: 'EKO1R',
      nameCs: 'Ekologie I (RSZ)',
      nameEn: 'Ecology I',
      reasons: ['sameName', 'sameGuarantor'],
      completion: 'credit',
      completionChanged: true,
      lastYear: 2025,
    },
  ],
};

describe('SimilarFileSchema', () => {
  it('accepts the file build-similar.ts writes', () => {
    expect(SimilarFileSchema.safeParse(ok).success).toBe(true);
  });

  it('keeps a reason it does not know, so a newer file still parses', () => {
    const next = { ...ok, suggestions: [{ ...ok.suggestions[0], reasons: ['sameSomethingNew'] }] };
    expect(SimilarFileSchema.safeParse(next).success).toBe(true);
  });

  it('accepts an unknown completion as null and no year as null', () => {
    const s = { ...ok.suggestions[0], completion: null, lastYear: null };
    expect(SimilarFileSchema.safeParse({ ...ok, suggestions: [s] }).success).toBe(true);
  });

  it('rejects a suggestion without its flags', () => {
    const { completionChanged: _drop, ...broken } = ok.suggestions[0]!;
    expect(SimilarFileSchema.safeParse({ ...ok, suggestions: [broken] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/types/schemas/__tests__/similarSubjects.schema.test.ts`
Expected: FAIL, "Failed to resolve import ../similarSubjects.schema".

- [ ] **Step 3: Implement the schema**

```ts
import { z } from 'zod';

// reis-data `similar/<CODE>.json`: old subjects offered to preview when a
// subject has no success rates of its own. Written by reis-scraper's
// scripts/build-similar.ts.
//
// Structure is validated, domain is not: `reasons` stays an open string list so
// a reason added later does not drop the whole file (the UI shows the ones it
// knows), and `.passthrough()` keeps future fields.

export const SimilarSuggestionSchema = z
  .object({
    code: z.string().min(1),
    nameCs: z.string(),
    nameEn: z.string(),
    reasons: z.array(z.string()),
    completion: z.enum(['exam', 'credit']).nullable(),
    completionChanged: z.boolean(),
    lastYear: z.number().int().nullable(),
  })
  .passthrough();

export const SimilarFileSchema = z
  .object({
    courseCode: z.string().min(1),
    suggestions: z.array(SimilarSuggestionSchema),
  })
  .passthrough();

export type SimilarSuggestion = z.infer<typeof SimilarSuggestionSchema>;
```

- [ ] **Step 4: Implement the fetcher**

It's tested through the slice in Task 2, with a stubbed `fetch`.

```ts
/**
 * Similar subjects for a subject with no success rates — reis-data
 * `similar/<CODE>.json`. Asked only after the subject's own stats came back
 * empty (see createSuccessRateSlice). A 404 is the normal answer: no file
 * means reIS has nothing to suggest.
 */
import { CDN_BASE_URL } from './successRate';
import { SimilarFileSchema, type SimilarSuggestion } from '../types/schemas/similarSubjects.schema';

export const MAX_SIMILAR = 3;

export async function fetchSimilarSubjects(courseCode: string): Promise<SimilarSuggestion[]> {
  // Same revalidation as subjects/: jsDelivr's week-long max-age would
  // otherwise hand back a copy from before the last refresh.
  const response = await fetch(`${CDN_BASE_URL}/similar/${courseCode}.json`, { cache: 'no-cache' });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const parsed = SimilarFileSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(`similar/${courseCode}.json: ${parsed.error.message}`);
  if (parsed.data.courseCode !== courseCode) {
    throw new Error(`similar/${courseCode}.json is for ${parsed.data.courseCode}`);
  }
  return parsed.data.suggestions.slice(0, MAX_SIMILAR);
}
```

- [ ] **Step 5: Run the test and typecheck**

Run: `npx vitest run src/types/schemas/__tests__/similarSubjects.schema.test.ts && npm run typecheck`
Expected: 4 tests pass; typecheck is silent.

- [ ] **Step 6: Commit**

```bash
git add src/types/schemas/similarSubjects.schema.ts src/types/schemas/__tests__/similarSubjects.schema.test.ts src/api/similarSubjects.ts
git commit -m "feat(success-rate): schema and fetcher for reis-data similar/<CODE>.json"
```

### Task 2: The slice, and the trigger

**Files:**
- Create: `src/store/slices/createSimilarSubjectsSlice.ts`
- Modify: `src/services/storage/keys.ts`, `src/store/types.ts`, `src/store/useAppStore.ts`, `src/store/slices/createSuccessRateSlice.ts`
- Test: `src/store/slices/__tests__/similarSubjects.test.ts`

**Interfaces:**
- Consumes:
  - Task 1's `fetchSimilarSubjects` and `SimilarSuggestion`;
  - `isStaleForVersion` (`src/api/successRate.ts`), `ensureSuccessRateVersion` (`src/api/successRateVersion.ts`);
  - `IndexedDBService`, `logError`.
- Produces:
  - store state `similarSubjects: Record<string, SimilarSuggestion[]>`: absent means not asked yet, `[]` means nothing to suggest;
  - action `fetchSimilarSubjects(courseCode): Promise<void>`;
  - storage key `STORAGE_KEYS.SIMILAR_SUBJECTS = 'reis_similar_subjects'` in the `meta` store. It's a generic key-value store; the `success_rates` store would drop this shape, because its schema is fail-closed.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A subject with no success rates asks reis-data for similar subjects, once
 * per reis-data version. The version gate is mocked (successRateVersion.test.ts
 * covers it); storage is the real IndexedDBService over fake-indexeddb.
 */

const V1 = '2026-09-22T12:17:27.977Z';
const V2 = '2026-10-01T08:00:00.000Z';
const version = vi.hoisted(() => ({ current: null as string | null }));
vi.mock('../../../api/successRateVersion', () => ({
  getKnownSuccessRateVersion: vi.fn(async () => version.current),
  ensureSuccessRateVersion: vi.fn(async () => version.current),
}));

const { useAppStore } = await import('../../useAppStore');
const { IndexedDBService } = await import('../../../services/storage/IndexedDBService');
const { STORAGE_KEYS } = await import('../../../services/storage/keys');

const EKO1R = {
  code: 'EKO1R',
  nameCs: 'Ekologie I (RSZ)',
  nameEn: 'Ecology I',
  reasons: ['sameName', 'sameGuarantor'],
  completion: 'credit',
  completionChanged: true,
  lastYear: 2025,
};

function serve(files: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const m = /\/(similar|subjects)\/(.+)\.json$/.exec(url);
    const body = m ? files[`${m[1]}/${m[2]}`] : undefined;
    return body === undefined
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const similarCalls = (f: ReturnType<typeof serve>) =>
  f.mock.calls.filter(([u]) => String(u).includes('/similar/')).length;

beforeEach(async () => {
  version.current = V1;
  useAppStore.setState({ similarSubjects: {}, successRates: {}, successRatesLoading: {} } as never);
  await IndexedDBService.delete('meta', STORAGE_KEYS.SIMILAR_SUBJECTS);
  await IndexedDBService.delete('success_rates', 'current');
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchSimilarSubjects', () => {
  it('stores and persists the suggestions, stamped with the version', async () => {
    serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [EKO1R] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([EKO1R]);
    expect(await IndexedDBService.get('meta', STORAGE_KEYS.SIMILAR_SUBJECTS)).toEqual({
      EKOE1: { suggestions: [EKO1R], cdnVersion: V1 },
    });
  });

  it('treats a 404 as nothing to suggest', async () => {
    serve({});
    await useAppStore.getState().fetchSimilarSubjects('ZABAH');
    expect(useAppStore.getState().similarSubjects.ZABAH).toEqual([]);
  });

  it('drops a malformed file instead of showing it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [{ code: 'EKO1R' }] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([]);
    err.mockRestore();
  });

  it('does not ask again under the same version, and does after a refresh', async () => {
    const f = serve({ 'similar/EKOE1': { courseCode: 'EKOE1', suggestions: [EKO1R] } });
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    useAppStore.setState({ similarSubjects: {} } as never);
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(similarCalls(f)).toBe(1);
    expect(useAppStore.getState().similarSubjects.EKOE1).toEqual([EKO1R]);

    version.current = V2;
    await useAppStore.getState().fetchSimilarSubjects('EKOE1');
    expect(similarCalls(f)).toBe(2);
  });
});

describe('fetchSuccessRate → similar subjects', () => {
  const stats = {
    courseCode: 'PRVES',
    lastUpdated: V1,
    stats: [
      {
        semesterName: 'ZS 2025/2026 - ZF',
        semesterId: '794',
        year: 2025,
        totalPass: 9,
        totalFail: 1,
        sourceUrl: 'https://is.mendelu.cz/x',
        type: 'exam',
        terms: [],
      },
    ],
  };

  it('asks for similar subjects when the subject has no stats', async () => {
    serve({});
    const spy = vi.fn(async () => {});
    useAppStore.setState({ fetchSimilarSubjects: spy } as never);
    await useAppStore.getState().fetchSuccessRate('EKOE1');
    expect(spy).toHaveBeenCalledWith('EKOE1');
  });

  it('does not when the subject has stats of its own', async () => {
    serve({ 'subjects/PRVES': stats });
    const spy = vi.fn(async () => {});
    useAppStore.setState({ fetchSimilarSubjects: spy } as never);
    await useAppStore.getState().fetchSuccessRate('PRVES');
    expect(spy).not.toHaveBeenCalled();
    expect(useAppStore.getState().similarSubjects.PRVES).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/store/slices/__tests__/similarSubjects.test.ts`
Expected: FAIL. `fetchSimilarSubjects` is not a function, and `STORAGE_KEYS.SIMILAR_SUBJECTS` is undefined.

- [ ] **Step 3: Add the storage key**

In `src/services/storage/keys.ts`, after `SUCCESS_RATES_CDN_VERSION`:

```ts
  // similar/<CODE>.json suggestions, per course code, stamped with that version
  SIMILAR_SUBJECTS: 'reis_similar_subjects',
```

- [ ] **Step 4: Add the slice type**

In `src/store/types.ts`, add the import at the top:

```ts
import type { SimilarSuggestion } from '../types/schemas/similarSubjects.schema';
```

Insert this directly before `export interface EduroamSlice {`:

```ts
export interface SimilarSubjectsSlice {
  /** Old subjects offered to preview for a course code with no stats of its
   * own. Absent = not asked yet; [] = nothing to suggest. */
  similarSubjects: Record<string, SimilarSuggestion[]>;
  fetchSimilarSubjects: (courseCode: string) => Promise<void>;
}
```

In `export type AppState`, add `SimilarSubjectsSlice &` right after `SuccessRateSlice &`.

- [ ] **Step 5: Implement the slice**

```ts
import type { AppSlice, SimilarSubjectsSlice } from '../types';
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { fetchSimilarSubjects } from '../../api/similarSubjects';
import { isStaleForVersion } from '../../api/successRate';
import { ensureSuccessRateVersion } from '../../api/successRateVersion';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { STORAGE_KEYS } from '../../services/storage/keys';
import { logError } from '../../utils/reportError';

/** Persisted in `meta`, stamped with the reis-data version like success rates,
 * so a refresh reaches the Capacitor apps too — they never restart the way
 * the extension's iframe does. */
type Cache = Record<string, { suggestions: SimilarSuggestion[]; cdnVersion?: string }>;

const inFlight = new Set<string>();

const readCache = async (): Promise<Cache> =>
  ((await IndexedDBService.get('meta', STORAGE_KEYS.SIMILAR_SUBJECTS)) as Cache | undefined) ?? {};

export const createSimilarSubjectsSlice: AppSlice<SimilarSubjectsSlice> = (set, get) => ({
  similarSubjects: {},
  fetchSimilarSubjects: async (courseCode) => {
    if (inFlight.has(courseCode)) return;
    inFlight.add(courseCode);
    const show = (suggestions: SimilarSuggestion[]) =>
      set((state) => ({
        similarSubjects: { ...state.similarSubjects, [courseCode]: suggestions },
      }));
    try {
      const hit = (await readCache())[courseCode];
      if (hit) show(hit.suggestions);

      const version = await ensureSuccessRateVersion();
      if (hit && !isStaleForVersion(hit, version)) return;

      const suggestions = await fetchSimilarSubjects(courseCode);
      show(suggestions);
      await IndexedDBService.set('meta', STORAGE_KEYS.SIMILAR_SUBJECTS, {
        ...(await readCache()),
        [courseCode]: version === null ? { suggestions } : { suggestions, cdnVersion: version },
      });
    } catch (err) {
      logError('Api.fetchSimilarSubjects', err, { courseCode });
      // Nothing to suggest is the safe answer: the tab shows its plain empty state.
      if (!get().similarSubjects[courseCode]) show([]);
    } finally {
      inFlight.delete(courseCode);
    }
  },
});
```

- [ ] **Step 6: Compose it**

In `src/store/useAppStore.ts`:
- import: `import { createSimilarSubjectsSlice } from './slices/createSimilarSubjectsSlice';` after the `createSuccessRateSlice` import;
- spread: `...createSimilarSubjectsSlice(...a),` after `...createSuccessRateSlice(...a),`.

- [ ] **Step 7: The trigger**

In `src/store/slices/createSuccessRateSlice.ts`, `fetchSuccessRate`, replace:

```ts
      if (cached && !isStaleForVersion(cached, version)) return;
```

with:

```ts
      if (cached && !isStaleForVersion(cached, version)) {
        if (cached.stats.length === 0) void get().fetchSimilarSubjects(courseCode);
        return;
      }
```

After the `set(...)` that follows `fetchSubjectSuccessRates([courseCode], version)`, still inside the `try` and before `} catch (err) {`, add:

```ts
      // No stats of its own: look for similar subjects to offer instead.
      if (!result.data[courseCode]?.stats.length) void get().fetchSimilarSubjects(courseCode);
```

Do **not** add this trigger to `fetchSuccessRateBatch`. That path serves list badges, and a batch of 30 subjects must not fan out into 30 `similar/` requests. The tab calls `fetchSuccessRate`.

- [ ] **Step 8: Run the new tests and the neighbours**

Run: `npx vitest run src/store/slices/__tests__/similarSubjects.test.ts src/store/slices/__tests__/successRateFreshness.test.ts src/store/slices/__tests__/studyPlanSuccessRates.test.ts && npm run typecheck`
Expected: all pass (6 new); typecheck is silent.

- [ ] **Step 9: Prove the trigger test can fail**

Delete the `if (!result.data[courseCode]?.stats.length) …` line and re-run the first file.
Expected: "asks for similar subjects when the subject has no stats" fails. Restore the line.

- [ ] **Step 10: Commit**

```bash
git add src/store/slices/createSimilarSubjectsSlice.ts src/store/slices/__tests__/similarSubjects.test.ts src/store/slices/createSuccessRateSlice.ts src/store/types.ts src/store/useAppStore.ts src/services/storage/keys.ts
git commit -m "feat(success-rate): fetch similar subjects when a subject has no stats"
```

### Task 3: The tab's three states

**Files:**
- Create: `src/components/SuccessRate/SuccessRateView.tsx`, `src/components/SuccessRate/similarLabels.ts`, `src/components/SuccessRate/SimilarSubjectsList.tsx`, `src/components/SuccessRate/PreviewBanner.tsx`
- Modify: `src/components/SuccessRateTab.tsx` (replaced whole), `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`, `nuia-baseline.json`
- Test: `src/components/SuccessRateTab.test.tsx`

**Interfaces:**
- Consumes:
  - store `similarSubjects`, `fetchSuccessRate`;
  - `useSuccessRate(code)` (`src/hooks/data/useSuccessRate.ts`: it triggers `fetchSuccessRate` itself);
  - `SimilarSuggestion`.
- Produces:
  - `SuccessRateView({ semesters, facultyCode?, showIsBacklink })`;
  - `SimilarSubjectsList({ suggestions, onPick })`;
  - `PreviewBanner({ suggestion, onBack })`;
  - `knownReasons`, `completionChangeKey`, `staleYear` from `similarLabels.ts`.
  - `SuccessRateTab`'s props are unchanged, so `DrawerTabBody` needs no edit.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuccessRateTab } from './SuccessRateTab';
import { useAppStore } from '../store/useAppStore';
import type { SubjectSuccessRate } from '../types/documents';

const rate = (courseCode: string, type: 'exam' | 'credit' = 'credit'): SubjectSuccessRate => ({
  courseCode,
  lastUpdated: '2026-09-22T12:17:27.977Z',
  stats: [
    {
      semesterName: 'ZS 2025/2026 - ZF',
      semesterId: '794',
      year: 2025,
      totalPass: 65,
      totalFail: 2,
      sourceUrl: 'https://is.mendelu.cz/x',
      type,
      terms: [
        {
          term: 'Všechny termíny',
          grades: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 },
          pass: 65,
          fail: 2,
          creditGrades: { zap: 65, nezap: 2, zapNedost: 0 },
        },
      ],
    },
  ],
});
const EKO1R = {
  code: 'EKO1R',
  nameCs: 'Ekologie I (RSZ)',
  nameEn: 'Ecology I',
  reasons: ['sameName', 'sameGuarantor'],
  completion: 'credit' as const,
  completionChanged: true,
  lastYear: 2025,
};
const KLI = {
  code: 'KLI',
  nameCs: 'Klimatologie',
  nameEn: 'Climatology',
  reasons: ['sameGuarantor', 'someFutureReason'],
  completion: 'exam' as const,
  completionChanged: false,
  lastYear: 2020,
};

function seed(state: Record<string, unknown>) {
  useAppStore.setState({
    language: 'cz',
    successRates: {},
    successRatesLoading: {},
    similarSubjects: {},
    fetchSuccessRate: vi.fn(async () => {}),
    fetchSimilarSubjects: vi.fn(async () => {}),
    ...state,
  } as never);
}

describe('SuccessRateTab', () => {
  beforeEach(() => seed({}));

  it("shows the subject's own stats when it has them", () => {
    seed({ successRates: { TVKA1: rate('TVKA1') } });
    render(<SuccessRateTab courseCode="TVKA1" />);
    expect(screen.getByText(/67 studentů/)).toBeTruthy();
    expect(screen.queryByText('Podobné předměty z minulých let')).toBeNull();
  });

  it('says there are no results yet, and offers nothing, without suggestions', () => {
    seed({ similarSubjects: { ZZZ1: [] } });
    render(<SuccessRateTab courseCode="ZZZ1" />);
    expect(screen.getByText('Zatím bez výsledků')).toBeTruthy();
    expect(screen.queryByText('Podobné předměty z minulých let')).toBeNull();
  });

  it('lists suggestions with their reasons, the completion change and a stale year', () => {
    seed({ similarSubjects: { EKOE1: [EKO1R, KLI] } });
    render(<SuccessRateTab courseCode="EKOE1" />);
    expect(screen.getByText('Podobné předměty z minulých let')).toBeTruthy();
    expect(screen.getAllByText('stejný garant')).toHaveLength(2);
    expect(screen.getByText('stejný název')).toBeTruthy();
    expect(screen.getByText('dříve zápočet, nyní zkouška')).toBeTruthy();
    expect(screen.getByText('naposledy 2020/21')).toBeTruthy();
    expect(screen.queryByText(/someFutureReason/)).toBeNull();
  });

  it('previews a suggestion under a banner, without giving the new subject its numbers', () => {
    seed({ similarSubjects: { EKOE1: [EKO1R] }, successRates: { EKO1R: rate('EKO1R') } });
    render(<SuccessRateTab courseCode="EKOE1" />);
    fireEvent.click(screen.getByRole('button', { name: /EKO1R/ }));
    expect(screen.getByRole('status').textContent).toContain('Náhled jiného předmětu');
    expect(screen.getByRole('status').textContent).toContain('EKO1R');
    expect(screen.getByText(/67 studentů/)).toBeTruthy();
    expect(useAppStore.getState().successRates.EKOE1).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: /Zpět/ }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Podobné předměty z minulých let')).toBeTruthy();
  });

  it('does not carry a preview over to another subject that offers the same one', () => {
    // The desktop drawer reuses the tab when the student switches subject.
    // ZABAH and ZABIHY both offer KLI; the second must open on its list.
    seed({
      similarSubjects: { ZABAH: [KLI], ZABIHY: [KLI] },
      successRates: { KLI: rate('KLI', 'exam') },
    });
    const { rerender } = render(<SuccessRateTab courseCode="ZABAH" />);
    fireEvent.click(screen.getByRole('button', { name: /KLI/ }));
    expect(screen.getByRole('status')).toBeTruthy();

    rerender(<SuccessRateTab courseCode="ZABIHY" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Podobné předměty z minulých let')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/SuccessRateTab.test.tsx`
Expected: the "own stats" test passes against today's tab; the other four fail on missing text ("Zatím bez výsledků" and the rest).

- [ ] **Step 3: Add the copy**

Merge into the `successRate` object of `src/i18n/locales/cs.json`, after `allTerms`. Keep `noData`, which the preview and faculty-filter paths still use.

```json
{
  "noResultsTitle": "Zatím bez výsledků",
  "noResultsBody": "Pro tento předmět zatím nemáme žádné výsledky.",
  "similarHeading": "Podobné předměty z minulých let",
  "reason": {
    "sameName": "stejný název",
    "sameGuarantor": "stejný garant",
    "sameTeachers": "stejní vyučující",
    "sameLiterature": "společná literatura"
  },
  "wasCredit": "dříve zápočet, nyní zkouška",
  "wasExam": "dříve zkouška, nyní zápočet",
  "lastTaught": "naposledy {year}",
  "previewOf": "Náhled jiného předmětu",
  "back": "Zpět"
}
```

…and of `src/i18n/locales/en.json`:

```json
{
  "noResultsTitle": "No results yet",
  "noResultsBody": "We don't have any results for this subject yet.",
  "similarHeading": "Similar subjects from past years",
  "reason": {
    "sameName": "same name",
    "sameGuarantor": "same guarantor",
    "sameTeachers": "same teachers",
    "sameLiterature": "shared literature"
  },
  "wasCredit": "was a credit, now an exam",
  "wasExam": "was an exam, now a credit",
  "lastTaught": "last taught {year}",
  "previewOf": "Preview of another subject",
  "back": "Back"
}
```

- [ ] **Step 4: Move the chart body into `SuccessRateView`**

This is the existing body of `SuccessRateTab` from `const allStats` to the end of its JSX, with only these changes:
- it takes `semesters` instead of reading the store;
- the unused `data` guard is gone;
- `current = stats[sIdx]!` satisfies the nuia ratchet.

```tsx
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SemesterStats } from '../../types/documents';
import { sortSemesters } from '../../utils/semesterSort';
import { pickFacultyStats } from './pickFacultyStats';
import { GradeBarChart } from './GradeBarChart';
import { SemesterSelector } from './SemesterSelector';
import { TermBreakdown } from './TermBreakdown';
import { useTranslation } from '../../hooks/useTranslation';
import { ISBacklink } from '../SubjectFileDrawer/ISBacklink';

const COLORS: Record<string, string> = {
  A: 'var(--color-grade-a)',
  B: 'var(--color-grade-b)',
  C: 'var(--color-grade-c)',
  D: 'var(--color-grade-d)',
  E: 'var(--color-grade-e)',
  F: 'var(--color-grade-f)',
  FN: 'var(--color-grade-fn)',
};

/** One subject's grade distribution. Moved out of SuccessRateTab unchanged so a
 * similar subject's preview renders exactly what its own tab would. */
export function SuccessRateView({
  semesters,
  facultyCode,
  showIsBacklink,
}: {
  semesters: SemesterStats[];
  facultyCode?: string;
  showIsBacklink: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const { t } = useTranslation();

  const allStats = sortSemesters(semesters);
  const filtered = pickFacultyStats(allStats, facultyCode);
  if (filtered.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-full pt-16">
        <AlertTriangle className="w-8 h-8 opacity-40 mb-3" />
        <p className="text-sm opacity-60">{t('successRate.noData')}</p>
      </div>
    );
  const stats = filtered.slice(0, 5),
    sIdx = Math.min(idx, stats.length - 1),
    current = stats[sIdx]!; // non-empty: the filtered.length check above
  const isCredit = current.type === 'credit',
    total = current.totalPass + current.totalFail;
  const order = isCredit ? ['zap', 'nezap'] : ['A', 'B', 'C', 'D', 'E', 'F', 'FN'];
  const colors = isCredit ? { zap: 'var(--color-success)', nezap: 'var(--color-error)' } : COLORS;

  // Use "Všechny termíny" aggregate if available, otherwise sum all terms (legacy data)
  const aggregate = current.terms.find((t) => t.term === 'Všechny termíny');
  const grades = aggregate
    ? isCredit && aggregate.creditGrades
      ? {
          zap: aggregate.creditGrades.zap,
          nezap: aggregate.creditGrades.nezap + (aggregate.creditGrades.zapNedost || 0),
        }
      : (aggregate.grades as unknown as Record<string, number>)
    : current.terms.reduce((acc: Record<string, number>, tRes) => {
        if (isCredit && tRes.creditGrades) {
          acc.zap = (acc.zap || 0) + (tRes.creditGrades.zap || 0);
          acc.nezap =
            (acc.nezap || 0) + (tRes.creditGrades.nezap || 0) + (tRes.creditGrades.zapNedost || 0);
        } else if (tRes.grades) {
          Object.entries(tRes.grades).forEach(([g, c]) => (acc[g] = (acc[g] || 0) + c));
        }
        return acc;
      }, {});

  const max = Math.max(...order.map((g) => grades[g] || 0), 1);
  const individualTerms = current.terms.filter((t) => t.term !== 'Všechny termíny');

  return (
    <div className="flex flex-col h-full px-4 py-3 select-none font-inter overflow-y-auto">
      <div className="text-center mb-6 flex items-center justify-center gap-2">
        <span className="text-xs sm:text-sm opacity-50 font-bold uppercase tracking-wider">
          {total} {t('successRate.students')}{' '}
          {isCredit ? ` (${t('successRate.credit')})` : ` (${t('successRate.exam')})`}
        </span>
      </div>
      <GradeBarChart grades={grades} order={order} colors={colors} max={max} />
      {individualTerms.length > 0 && <TermBreakdown terms={individualTerms} isCredit={isCredit} />}
      <SemesterSelector stats={stats} activeIndex={sIdx} onSelect={setIdx} />
      {current.sourceUrl && showIsBacklink && <ISBacklink href={current.sourceUrl} />}
    </div>
  );
}
```

- [ ] **Step 5: Label logic**

```ts
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';

/** Reasons the UI knows how to say; an unknown one from a newer file is skipped. */
export const KNOWN_REASONS = [
  'sameName',
  'sameGuarantor',
  'sameTeachers',
  'sameLiterature',
] as const;

export const knownReasons = (s: SimilarSuggestion) =>
  KNOWN_REASONS.filter((r) => s.reasons.includes(r));

/** i18n key for a completion change, from the OLD subject's type. */
export const completionChangeKey = (s: SimilarSuggestion): string | null =>
  !s.completionChanged || !s.completion
    ? null
    : s.completion === 'credit'
      ? 'successRate.wasCredit'
      : 'successRate.wasExam';

/** "2020/21" when the old subject last ran before last academic year, else null. */
export function staleYear(lastYear: number | null, now = new Date()): string | null {
  if (lastYear === null) return null;
  const currentStart = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  if (lastYear >= currentStart - 1) return null;
  return `${lastYear}/${String((lastYear + 1) % 100).padStart(2, '0')}`;
}
```

- [ ] **Step 6: The cards**

```tsx
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { useTranslation } from '../../hooks/useTranslation';
import { completionChangeKey, knownReasons, staleYear } from './similarLabels';

/** Old subjects a student can preview. Facts only — the reasons reIS offered
 * each one — never a claim that it is this subject's predecessor. */
export function SimilarSubjectsList({
  suggestions,
  onPick,
}: {
  suggestions: SimilarSuggestion[];
  onPick: (code: string) => void;
}) {
  const { t, language } = useTranslation();
  return (
    <section className="w-full max-w-md" aria-label={t('successRate.similarHeading')}>
      <h3 className="text-sm font-semibold text-base-content/70 mb-2">
        {t('successRate.similarHeading')}
      </h3>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => {
          const change = completionChangeKey(s);
          const year = staleYear(s.lastYear);
          return (
            <li key={s.code}>
              <button
                type="button"
                onClick={() => onPick(s.code)}
                className="w-full text-left rounded-box bg-base-200 hover:bg-base-300 px-4 py-3 flex flex-col gap-1.5"
              >
                <span className="text-sm">
                  <span className="font-mono text-xs text-base-content/70 mr-2">{s.code}</span>
                  <span className="font-medium">
                    {language === 'en' && s.nameEn ? s.nameEn : s.nameCs}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {knownReasons(s).map((r) => (
                    <span key={r} className="badge badge-ghost badge-sm">
                      {t(`successRate.reason.${r}`)}
                    </span>
                  ))}
                  {change && <span className="badge badge-warning badge-sm">{t(change)}</span>}
                  {year && (
                    <span className="badge badge-ghost badge-sm">
                      {t('successRate.lastTaught', { year })}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 7: The banner**

It sits *above* the scrolling chart, not inside it, which is what "can't scroll away" means here.

```tsx
import { ArrowLeft } from 'lucide-react';
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { useTranslation } from '../../hooks/useTranslation';
import { completionChangeKey } from './similarLabels';

/** Sits above the scrolling chart, never inside it, so no screenshot of a
 * preview can be mistaken for the subject's own numbers. */
export function PreviewBanner({
  suggestion,
  onBack,
}: {
  suggestion: SimilarSuggestion;
  onBack: () => void;
}) {
  const { t, language } = useTranslation();
  const change = completionChangeKey(suggestion);
  return (
    <div
      role="status"
      className="shrink-0 flex items-start gap-2 px-4 py-2 bg-base-200 border-b border-base-300"
    >
      <button type="button" onClick={onBack} className="btn btn-ghost btn-xs gap-1 shrink-0">
        <ArrowLeft className="w-3.5 h-3.5" />
        {t('successRate.back')}
      </button>
      <p className="text-xs leading-5 min-w-0">
        <span className="text-base-content/70">{t('successRate.previewOf')}: </span>
        <span className="font-mono">{suggestion.code}</span>{' '}
        <span className="font-medium">
          {language === 'en' && suggestion.nameEn ? suggestion.nameEn : suggestion.nameCs}
        </span>
        {change && (
          <span className="badge badge-warning badge-sm ml-2 align-middle">{t(change)}</span>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Replace `SuccessRateTab.tsx`**

```tsx
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import type { SimilarSuggestion } from '../types/schemas/similarSubjects.schema';
import { SuccessRateView } from './SuccessRate/SuccessRateView';
import { SimilarSubjectsList } from './SuccessRate/SimilarSubjectsList';
import { PreviewBanner } from './SuccessRate/PreviewBanner';

const Spinner = () => (
  <div className="flex items-center justify-center h-full">
    <span className="loading loading-spinner text-primary" />
  </div>
);

/**
 * Úspěšnost, on both trees (DrawerTabBody mounts it for the extension drawer
 * and the phone sheet). Three states: the subject's own stats; no stats, with
 * or without similar subjects to offer; and a preview of one of them.
 */
export function SuccessRateTab({
  courseCode,
  facultyCode,
  showIsBacklink = true,
}: {
  courseCode: string;
  facultyCode?: string;
  /** Off for the phone sheet — see `showIsBacklink` in DrawerTabBody. */
  showIsBacklink?: boolean;
}) {
  const { stats: data, loading } = useSuccessRate(courseCode);
  const suggestions = useAppStore((s) => s.similarSubjects[courseCode]);
  // Which subject the preview was opened FOR: the desktop drawer reuses this
  // component across subjects, and two new subjects can offer the same old one.
  const [preview, setPreview] = useState<{ course: string; code: string } | null>(null);
  const previewCode = preview?.course === courseCode ? preview.code : null;
  const { t } = useTranslation();

  if (loading) return <Spinner />;
  if (data?.stats?.length)
    return (
      <SuccessRateView
        semesters={data.stats}
        facultyCode={facultyCode}
        showIsBacklink={showIsBacklink}
      />
    );

  const picked = suggestions?.find((s) => s.code === previewCode);
  if (picked)
    return (
      <SimilarPreview
        suggestion={picked}
        facultyCode={facultyCode}
        showIsBacklink={showIsBacklink}
        onBack={() => setPreview(null)}
      />
    );

  return (
    <div className="flex flex-col items-center h-full px-4 pt-12 pb-4 gap-6 overflow-y-auto">
      <div className="flex flex-col items-center text-center">
        <AlertTriangle className="w-8 h-8 opacity-40 mb-3" />
        <p className="text-sm font-medium">{t('successRate.noResultsTitle')}</p>
        <p className="text-xs text-base-content/70 mt-1">{t('successRate.noResultsBody')}</p>
      </div>
      {suggestions && suggestions.length > 0 && (
        <SimilarSubjectsList
          suggestions={suggestions}
          onPick={(code) => setPreview({ course: courseCode, code })}
        />
      )}
    </div>
  );
}

function SimilarPreview({
  suggestion,
  facultyCode,
  showIsBacklink,
  onBack,
}: {
  suggestion: SimilarSuggestion;
  facultyCode?: string;
  showIsBacklink: boolean;
  onBack: () => void;
}) {
  // Loads under the OLD code, where these stats belong; the new code's entry
  // stays empty, so list badges and insights never show borrowed numbers.
  const { stats, loading } = useSuccessRate(suggestion.code);
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      <PreviewBanner suggestion={suggestion} onBack={onBack} />
      <div className="flex-1 min-h-0">
        {loading ? (
          <Spinner />
        ) : stats?.stats?.length ? (
          <SuccessRateView
            semesters={stats.stats}
            facultyCode={facultyCode}
            showIsBacklink={showIsBacklink}
          />
        ) : (
          <p className="text-sm text-base-content/70 text-center pt-16">
            {t('successRate.noData')}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Take `SuccessRateTab.tsx` out of the nuia baseline**

Delete the line `"src/components/SuccessRateTab.tsx",` from `nuia-baseline.json`.

- [ ] **Step 10: Run the tests and the gates**

Run: `npx vitest run src/components/SuccessRateTab.test.tsx src/store/slices/__tests__/similarSubjects.test.ts && npm run typecheck && npm run nuia:gate`
Expected: 11 pass; typecheck is silent; `✅ nuia ratchet ok`.
Run: `npx prettier --write` on every file this plan created or touched, then `npx eslint --max-warnings=0` on the same list.
Expected: no findings.

- [ ] **Step 11: Commit**

```bash
git add src/components/SuccessRateTab.tsx src/components/SuccessRateTab.test.tsx src/components/SuccessRate/ src/i18n/locales/cs.json src/i18n/locales/en.json nuia-baseline.json
git commit -m "feat(success-rate): offer similar subjects to preview when a subject has no results"
```

### Task 4: Verify on every shell, then open the PR

**Files:** none new.

- [ ] **Step 1: Start the dev webapp**

`preview_start { name: "reis-webapp" }`. Never start it through Bash.

- [ ] **Step 2: Reach the three states with real data**

The maintainer's own account has none of the new codes, and reis-data has no `similar/` files until the scraper plan publishes. So:
- In the Browser pane, run
  `window.__reisStore.setState({ fetchSimilarSubjects: async (c) => window.__reisStore.setState((s) => ({ similarSubjects: { ...s.similarSubjects, [c]: FILES[c] ?? [] } })) })`,
  with `FILES` being the payload from `similar/EKOE1.json` (the scraper plan's Task 4 output, or the spec's example).
- Then open a sheet with
  `window.__reisStore.getState().pushSheet({ kind: 'subjectDrawer', courseCode: 'EKOE1', courseName: 'Ekologie I (RASZ)' })`
  and click "Úspěšnost".
- The old subjects' stats are real, on the CDN.

- [ ] **Step 3: Measure, don't eyeball**

Use the verify-ui skill. Run the phone set, the tablet set (`--widths 834,1024,1194 --url …/?mobile=1`) and the desktop drawer (`?mobile=0`, then open a subject from Rozvrh), each in `--theme dark` and `--theme light`. Every run must show:
- no `overflow` / `collision` errors;
- no `contrast-*` warnings on the new elements: the badges, the banner, and the `/70` muted text.

At `1024`, check the list with three cards and the preview: `#root` clips, it doesn't scroll.

- [ ] **Step 4: Send before/after PNGs**

Use the verify-ui recipe's Playwright script, writing into `.verify/`. Screens: the list (EKOE1), the preview (EKOE1 → EKO1R), and the plain empty state. Send them with `SendUserFile` before calling the work done.

- [ ] **Step 5: Push and open the PR against `test`**

`git push`, then `gh pr create --base test`. The body should:
- link the spec and the scraper PR;
- say that without `similar/` files on the CDN the tab shows only the new empty-state copy.

End with the attribution line, then turn on Auto-fix for the PR.
