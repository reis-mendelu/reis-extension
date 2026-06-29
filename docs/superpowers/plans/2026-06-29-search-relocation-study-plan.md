# Search Relocation → Study Plan Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the people+subjects search out of the always-on header and mount it inside the Study Plan page, where it is self-wired to that page's "Click to search" rows.

**Architecture:** Reuse the existing `SearchBar`/`useSearch` verbatim — only its mount location changes. `StudyPlanPage` gains a local prefill ref, builds its own `onSearchSubject` callback (instead of receiving one from `AppMain`), and renders `SearchBar` in its header (inline-right on desktop, full-width row under the title on mobile). `AppMain` stops passing `onSearchSubject` to `StudyPlanPage`.

**Tech Stack:** WXT, React 19, TypeScript (strict), Tailwind 4 + DaisyUI 5, Zustand, Vitest + happy-dom + @testing-library/react.

## Global Constraints

- **Do NOT edit `src/components/AppHeader.tsx`** — Tonda owns removing the header search; avoid collision.
- **Do NOT modify `SearchBar/*` or `useSearch.ts`** — reused as-is.
- **Do NOT touch `SubjectRow.tsx`** — it keeps `onSearchSubject` required; the Study Plan just supplies a local implementation.
- Search placeholder: use `SearchBar`'s default (subjects/people) — pass no `placeholder` prop.
- Iron rules: no `localStorage`/`sessionStorage`; no custom CSS (DaisyUI classes only); max 200 lines/file; direct imports only; test-first (TDD).
- After implementation, `npm run build` must exit 0 (per project convention), plus `npm run typecheck` and `npm run lint` clean.

---

### Task 1: Mount the on-page search in the Study Plan page

**Files:**
- Modify: `src/components/SubjectsPanel/StudyPlanPage.tsx`
- Modify: `src/components/AppMain.tsx:45`
- Test: `src/components/SubjectsPanel/__tests__/StudyPlanPage.test.tsx` (create)

**Interfaces:**
- Consumes: `SearchBar` from `../SearchBar/index` with props `{ onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string, facultyCode?: string) => void; prefillRef?: React.MutableRefObject<((query: string) => void) | null> }`. The `prefillRef` callback, when registered by `SearchBar`, sets the query + focuses + opens the dropdown.
- Produces: `StudyPlanPage` now has props `{ onBack: () => void; onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void }` — the `onSearchSubject` prop is **removed** (built internally).

- [ ] **Step 1: Write the failing test**

Create `src/components/SubjectsPanel/__tests__/StudyPlanPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoisted so the vi.mock factories (which are hoisted above imports) can use them.
const { prefillSpy, plan } = vi.hoisted(() => ({
  prefillSpy: vi.fn(),
  plan: {
    title: 'Test plan', isFulfilled: false, creditsAcquired: 0, creditsRequired: 180,
    blocks: [{
      title: 'Semester 1',
      groups: [{
        name: 'Required', statusDescription: '', subjects: [
          { id: '', code: 'EBC-ST', name: 'Statistika', credits: 5, type: 'P', isEnrolled: false, isFulfilled: false, enrollmentCount: 0, rawStatusText: '' },
        ],
      }],
    }],
  },
}));

// SearchBar: register the prefill spy into prefillRef like the real component does, render a marker.
vi.mock('../../SearchBar/index', () => ({
  SearchBar: ({ prefillRef }: { prefillRef?: React.MutableRefObject<((q: string) => void) | null> }) => {
    React.useEffect(() => { if (prefillRef) prefillRef.current = prefillSpy; });
    return <div data-testid="study-plan-search" />;
  },
}));

// SemesterSection: expose the onSearchSubject it receives via a clickable button.
vi.mock('../SemesterSection', () => ({
  SemesterSection: ({ onSearchSubject }: { onSearchSubject: (n: string) => void }) => (
    <button onClick={() => onSearchSubject('Statistika')}>mock-row-search</button>
  ),
}));

// Keep the rest of the page light and deterministic.
vi.mock('@/hooks/useStudyPlan', () => ({ useStudyPlan: () => plan }));
vi.mock('../useSubjectsData', () => ({ useSubjectsData: () => ({ zameraniLookup: new Map(), subjectSemesters: new Map(), subjectToZameranis: new Map(), zameraniProgress: new Map(), failRates: {}, enrolledCredits: 0 }) }));
vi.mock('../useOpenSemesters', () => ({ useOpenSemesters: () => ({ openSemesters: new Set(), currentSemesterRef: { current: null }, handleToggle: () => {} }) }));
vi.mock('../useZameraniPicks', () => ({ useZameraniPicks: () => ({ effectivePicks: [], togglePick: () => {} }) }));
vi.mock('../insights', () => ({ topHardestUpcoming: () => [], zameraniInsights: () => [] }));

import { StudyPlanPage } from '../StudyPlanPage';
import { useAppStore } from '@/store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ language: 'en', successRates: {} });
  prefillSpy.mockClear();
});

describe('StudyPlanPage on-page search', () => {
  it('renders the search box in the header', () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.getByTestId('study-plan-search')).toBeTruthy();
  });

  it('routes a subject row "Click to search" into the on-page search prefill', async () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    await userEvent.click(screen.getByText('mock-row-search'));
    expect(prefillSpy).toHaveBeenCalledWith('Statistika');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/StudyPlanPage.test.tsx`
Expected: FAIL — `getByTestId('study-plan-search')` not found (SearchBar not mounted yet), and the second test fails because `StudyPlanPage` still requires an `onSearchSubject` prop / doesn't wire the local ref.

- [ ] **Step 3: Rewire `StudyPlanPage` to own and mount the search**

In `src/components/SubjectsPanel/StudyPlanPage.tsx`:

(a) Update the React import (currently `import { useMemo } from 'react';`):

```tsx
import { useMemo, useRef, useCallback } from 'react';
```

(b) Add the `SearchBar` import alongside the other component imports (e.g. under the `ArrowLeft` import):

```tsx
import { SearchBar } from '../SearchBar/index';
```

(c) Update the props interface — remove `onSearchSubject`:

```tsx
interface StudyPlanPageProps {
  onBack: () => void;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
}
```

(d) Update the function signature — drop `onSearchSubject`:

```tsx
export function StudyPlanPage({ onBack, onOpenSubject }: StudyPlanPageProps) {
```

(e) Right after `const { t } = useTranslation();`, add the local prefill ref and the locally-built `onSearchSubject`:

```tsx
  const searchPrefillRef = useRef<((query: string) => void) | null>(null);
  const onSearchSubject = useCallback((name: string) => {
    searchPrefillRef.current?.(name);
  }, []);
```

(f) Replace the `header` JSX (currently the `<div className="px-4 py-2.5 border-b border-base-300 shrink-0 flex items-center gap-2">…</div>`) with a responsive version that adds the search. `SearchBar`'s `onOpenSubject` types `courseName`/`courseId` as optional, so wrap the page's `onOpenSubject` in a small adapter that fills the required args:

```tsx
  const header = (
    <div className="px-4 py-2.5 border-b border-base-300 shrink-0 flex flex-col gap-2 md:flex-row md:items-center">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onBack} className="btn btn-ghost btn-sm btn-circle text-base-content/60" aria-label={t('common.back')}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold truncate" title={plan?.title}>{t('subjects.studyPlan')}</h2>
      </div>
      <div className="w-full md:ml-auto md:w-auto md:max-w-sm">
        <SearchBar
          onOpenSubject={(code, name, id, faculty) => onOpenSubject(code, name ?? code, id ?? '', faculty)}
          prefillRef={searchPrefillRef}
        />
      </div>
    </div>
  );
```

Leave the three `onSearchSubject={onSearchSubject}` usages (`HardestUpcomingCard`, `ZameraniComparisonCard`, `SemesterSection`) exactly as they are — they now reference the locally-built callback.

- [ ] **Step 4: Update `AppMain` to stop passing `onSearchSubject` to `StudyPlanPage`**

In `src/components/AppMain.tsx`, line 45, change:

```tsx
{currentView === 'studyPlan' && <StudyPlanPage onBack={() => setCurrentView?.('subjects')} onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
```

to:

```tsx
{currentView === 'studyPlan' && <StudyPlanPage onBack={() => setCurrentView?.('subjects')} onOpenSubject={handleOpenSubjectFromSearch} />}
```

Leave the `SubjectsPanel` (line 44) and `ErasmusPanel` (line 46) lines unchanged — their `onSearchSubject` wiring stays (it no-ops after the header search is removed; redesigning those rows is out of scope).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/StudyPlanPage.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0. (Typecheck specifically confirms `AppMain` no longer passes a now-removed prop and the `SearchBar` `onOpenSubject` adapter is well-typed.)

- [ ] **Step 7: Commit**

```bash
git add src/components/SubjectsPanel/StudyPlanPage.tsx src/components/AppMain.tsx src/components/SubjectsPanel/__tests__/StudyPlanPage.test.tsx
git commit -m "feat(search): mount search in Study Plan page, self-wire prefill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual verification (after Task 1)

Once Tonda's header-search removal is also merged, load the extension on the Study Plan page and confirm:
- The search box appears in the header (right side on desktop, full-width row under the title on a narrow window) with the normal subjects/people placeholder.
- ⌘K focuses it while on the Study Plan; it does nothing on other views.
- A not-enrolled ("Search to open") row fills the on-page search with the subject name.

## Self-Review

- **Spec coverage:** Placement (Step 3f, responsive) ✓; reuse SearchBar verbatim (import only) ✓; on-page prefill wiring (Step 3e + threaded callback) ✓; AppMain rewire (Step 4) ✓; AppHeader untouched (Global Constraints) ✓; SubjectRow untouched (Global Constraints) ✓; Erasmus/Subjects left as-is (Step 4 note) ✓; study-plan-only ⌘K (inherent — listeners live in SearchBar, mounted only here) ✓; testing (Step 1) ✓.
- **Placeholder scan:** none — all steps contain concrete code/commands.
- **Type consistency:** `prefillRef` type matches `SearchBar`'s prop; the `onOpenSubject` adapter `(code, name, id, faculty) => onOpenSubject(code, name ?? code, id ?? '', faculty)` satisfies the required-arg page prop from the optional-arg SearchBar prop; removed `onSearchSubject` prop is reflected in both the interface and the `AppMain` call site.
