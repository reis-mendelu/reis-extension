# Erasmus Subjects Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the study plan (KontrolaPlanu) is missing or empty — the Erasmus case — the Předměty view renders the enrolled-subjects card from the already-synced `subjects` store instead of "No study plan data".

**Architecture:** A pure helper `buildFallbackPlan` maps the `subjects` store (from `student/list.pl`) into a minimal one-block `StudyPlan`; `SubjectsPanel` gains a render branch that feeds it into the existing `EnrolledNowSection` plus a caption. No sync changes, no persistence — the synthetic plan exists only during render. Spec: `docs/superpowers/specs/2026-07-02-erasmus-subjects-fallback-design.md`.

**Tech Stack:** React 19, Zustand (`useAppStore`), TypeScript strict, Vitest + happy-dom + @testing-library/react, DaisyUI classes.

## Global Constraints

- NO `useEffect` for data fetching in components (the fallback is pure derivation from store state).
- NO custom CSS — DaisyUI/Tailwind semantic classes only.
- Max 200 lines per file.
- Direct imports only — no re-export barrels.
- Test first: write the failing test before implementation.
- Do not touch any parser (`src/api/**` parsers are off-limits per CLAUDE.md).
- Path alias `@/*` → `src/*`.

---

### Task 1: `buildFallbackPlan` util

**Files:**
- Create: `src/components/SubjectsPanel/buildFallbackPlan.ts`
- Test: `src/components/SubjectsPanel/__tests__/buildFallbackPlan.test.ts`

**Interfaces:**
- Consumes: `SubjectsData`/`SubjectInfo` from `@/types/documents`, `StudyPlan`/`SubjectStatus` from `@/types/studyPlan` (both already exist).
- Produces: `buildFallbackPlan(subjects: SubjectsData, language: 'cs' | 'en'): StudyPlan` — Task 2 imports exactly this signature.

- [ ] **Step 1: Write the failing test**

Create `src/components/SubjectsPanel/__tests__/buildFallbackPlan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFallbackPlan } from '../buildFallbackPlan';
import type { SubjectsData } from '@/types/documents';

const subjects: SubjectsData = {
  version: 1,
  lastUpdated: '2026-07-02T00:00:00.000Z',
  data: {
    'EBC-ST': {
      displayName: 'Statistika (display)',
      fullName: 'EBC-ST Statistika',
      nameCs: 'Statistika',
      nameEn: 'Statistics',
      subjectCode: 'EBC-ST',
      subjectId: '123456',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1',
      fetchedAt: '2026-07-02T00:00:00.000Z',
    },
    'EBC-XX': {
      displayName: 'Display Only',
      fullName: 'EBC-XX Display Only',
      subjectCode: 'EBC-XX',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=2',
      fetchedAt: '2026-07-02T00:00:00.000Z',
    },
  },
};

describe('buildFallbackPlan', () => {
  it('maps every subject into one block/one group as enrolled, unfulfilled', () => {
    const plan = buildFallbackPlan(subjects, 'cs');
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].groups).toHaveLength(1);
    const list = plan.blocks[0].groups[0].subjects;
    expect(list).toHaveLength(2);
    const st = list.find(s => s.code === 'EBC-ST')!;
    expect(st.id).toBe('123456');
    expect(st.isEnrolled).toBe(true);
    expect(st.isFulfilled).toBe(false);
    expect(st.credits).toBe(0);
  });

  it('picks nameEn for en and nameCs for cs', () => {
    const en = buildFallbackPlan(subjects, 'en').blocks[0].groups[0].subjects.find(s => s.code === 'EBC-ST')!;
    const cs = buildFallbackPlan(subjects, 'cs').blocks[0].groups[0].subjects.find(s => s.code === 'EBC-ST')!;
    expect(en.name).toBe('Statistics');
    expect(cs.name).toBe('Statistika');
  });

  it('falls back to displayName when the language name is missing', () => {
    const s = buildFallbackPlan(subjects, 'en').blocks[0].groups[0].subjects.find(x => x.code === 'EBC-XX')!;
    expect(s.name).toBe('Display Only');
  });

  it('missing subjectId maps to empty id', () => {
    const s = buildFallbackPlan(subjects, 'cs').blocks[0].groups[0].subjects.find(x => x.code === 'EBC-XX')!;
    expect(s.id).toBe('');
  });

  it('handles an empty subjects store', () => {
    const plan = buildFallbackPlan({ version: 1, lastUpdated: '', data: {} }, 'cs');
    expect(plan.blocks[0].groups[0].subjects).toHaveLength(0);
    expect(plan.creditsAcquired).toBe(0);
    expect(plan.creditsRequired).toBe(0);
    expect(plan.isFulfilled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/buildFallbackPlan.test.ts`
Expected: FAIL — cannot resolve `../buildFallbackPlan`.

- [ ] **Step 3: Write the implementation**

Create `src/components/SubjectsPanel/buildFallbackPlan.ts`:

```ts
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import type { SubjectsData } from '@/types/documents';

/**
 * Builds a minimal one-block StudyPlan from the subjects store (student/list.pl)
 * for students without KontrolaPlanu (e.g. Erasmus/exchange). Render-only —
 * never persisted, so it cannot leak into other plan consumers.
 */
export function buildFallbackPlan(subjects: SubjectsData, language: 'cs' | 'en'): StudyPlan {
  const items: SubjectStatus[] = Object.values(subjects.data).map(info => ({
    id: info.subjectId ?? '',
    code: info.subjectCode,
    name: (language === 'en' ? info.nameEn : info.nameCs) ?? info.displayName,
    credits: 0,
    type: '',
    isEnrolled: true,
    isFulfilled: false,
    enrollmentCount: 0,
    rawStatusText: '',
  }));

  return {
    title: '',
    isFulfilled: false,
    creditsAcquired: 0,
    creditsRequired: 0,
    blocks: [{ title: '', groups: [{ name: '', statusDescription: '', subjects: items }] }],
    zameranis: [],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/buildFallbackPlan.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck, build, commit**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

```bash
git add src/components/SubjectsPanel/buildFallbackPlan.ts src/components/SubjectsPanel/__tests__/buildFallbackPlan.test.ts
git commit -m "feat(subjects): buildFallbackPlan maps subjects store to a minimal StudyPlan"
```

---

### Task 2: SubjectsPanel fallback branch + i18n

**Files:**
- Modify: `src/components/SubjectsPanel/index.tsx` (currently 70 lines — full replacement below)
- Modify: `src/i18n/locales/en.json` (add one key inside the existing `"subjects"` object)
- Modify: `src/i18n/locales/cs.json` (same key)
- Test: `src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx`

**Interfaces:**
- Consumes: `buildFallbackPlan(subjects: SubjectsData, language: 'cs' | 'en'): StudyPlan` from Task 1; existing `EnrolledNowSection` (`plan`, `failRates`, `onOpenSubject`, `onSearchSubject` props); existing store fields `subjects`, `language`, `studyPlanLoaded`, `syncStatus`.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Write the failing component test**

Create `src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyPlan } from '@/types/studyPlan';
import type { SubjectsData } from '@/types/documents';

// EnrolledNowSection has deep child deps (SubjectRow etc.) — replace with a
// marker that exposes which subject codes it received.
vi.mock('../EnrolledNowSection', () => ({
  EnrolledNowSection: ({ plan }: { plan: StudyPlan }) => (
    <div data-testid="enrolled-now">
      {plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code))).join(',')}
    </div>
  ),
}));
// Avoid the success-rate batch fetch effect inside useSubjectsData.
vi.mock('../useSubjectsData', () => ({
  useSubjectsData: () => ({
    zameraniLookup: new Map(), subjectSemesters: new Map(), subjectToZameranis: new Map(),
    zameraniProgress: new Map(), failRates: {}, enrolledCredits: 0,
  }),
}));

import { SubjectsPanel } from '../index';
import { useAppStore } from '@/store/useAppStore';

const subjects: SubjectsData = {
  version: 1,
  lastUpdated: '2026-07-02T00:00:00.000Z',
  data: {
    'EBC-ST': {
      displayName: 'Statistika', fullName: 'EBC-ST Statistika', nameCs: 'Statistika', nameEn: 'Statistics',
      subjectCode: 'EBC-ST', subjectId: '123456',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1', fetchedAt: '',
    },
  },
};

const emptyPlan: StudyPlan = {
  title: 'Empty', isFulfilled: false, creditsAcquired: 0, creditsRequired: 0,
  blocks: [{ title: '1. semestr', groups: [{ name: 'G', statusDescription: '', subjects: [] }] }],
};

function setStore(overrides: { plan?: StudyPlan | null; subjects?: SubjectsData | null }) {
  useAppStore.setState({
    language: 'en',
    studyPlanDual: overrides.plan ? { cz: overrides.plan, en: overrides.plan } : null,
    studyPlanLoaded: true,
    subjects: overrides.subjects ?? null,
    syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
  });
}

function renderPanel() {
  return render(
    <SubjectsPanel onOpenSubject={() => {}} onSearchSubject={() => {}} onOpenStudyPlan={() => {}} />
  );
}

beforeEach(() => {
  setStore({ plan: null, subjects: null });
});

describe('SubjectsPanel Erasmus fallback', () => {
  it('renders the fallback card from the subjects store when the plan is null', () => {
    setStore({ plan: null, subjects });
    renderPanel();
    expect(screen.getByTestId('enrolled-now').textContent).toBe('EBC-ST');
  });

  it('renders the fallback when the plan exists but has zero subjects', () => {
    setStore({ plan: emptyPlan, subjects });
    renderPanel();
    expect(screen.getByTestId('enrolled-now').textContent).toBe('EBC-ST');
  });

  it('shows the exchange caption and hides the Study Plan button in fallback mode', () => {
    setStore({ plan: null, subjects });
    renderPanel();
    expect(screen.getByText(/exchange studies/i)).toBeTruthy();
    expect(screen.queryByText('Study Plan')).toBeNull();
  });

  it('still shows the noData empty state when both plan and subjects are missing', () => {
    setStore({ plan: null, subjects: null });
    renderPanel();
    expect(screen.getByText('No study plan data')).toBeTruthy();
    expect(screen.queryByTestId('enrolled-now')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx`
Expected: FAIL — the two fallback renders show "No study plan data" instead of the `enrolled-now` marker, and the caption test finds no match. (The noData test may already pass — that's fine.)

- [ ] **Step 3: Add the i18n key**

In `src/i18n/locales/en.json`, inside the existing `"subjects"` object (e.g. right after `"noData"`), add:

```json
"noPlanExchange": "Study plan isn't available for exchange studies — showing your enrolled subjects instead.",
```

In `src/i18n/locales/cs.json`, same position, add:

```json
"noPlanExchange": "Studijní plán není pro výměnná studia dostupný — zobrazujeme tvoje zapsané předměty.",
```

- [ ] **Step 4: Implement the fallback branch**

Replace the full contents of `src/components/SubjectsPanel/index.tsx` with:

```tsx
import { useMemo } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { EnrolledNowSection } from './EnrolledNowSection';
import { StudyAveragesSection } from './StudyAveragesSection';
import { useSubjectsData } from './useSubjectsData';
import { buildFallbackPlan } from './buildFallbackPlan';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
  onOpenStudyPlan: () => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject, onOpenStudyPlan }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore(s => s.studyPlanLoaded);
  const studyStats = useAppStore(s => s.studyStats);
  const studyComparison = useAppStore(s => s.studyComparison);
  const subjects = useAppStore(s => s.subjects);
  const language = useAppStore(s => s.language);
  const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore(s => s.syncStatus.isSyncing);

  // Erasmus/exchange students have no KontrolaPlanu, so the plan never
  // materializes — fall back to the subjects store (student/list.pl).
  const planUsable = !!plan && plan.blocks.some(b => b.groups.some(g => g.subjects.length > 0));
  const fallbackPlan = useMemo(() => {
    if (planUsable || !subjects || Object.keys(subjects.data).length === 0) return null;
    return buildFallbackPlan(subjects, language === 'en' ? 'en' : 'cs');
  }, [planUsable, subjects, language]);

  const effectivePlan = planUsable ? plan : fallbackPlan;
  const { subjectSemesters, subjectToZameranis, zameraniProgress, failRates, enrolledCredits } = useSubjectsData(effectivePlan);

  if (!effectivePlan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) return <SubjectsPanelSkeleton />;
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  if (!planUsable) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-0 shrink-0">
          <div className="flex items-start gap-2 text-xs text-base-content/50 pb-3">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('subjects.noPlanExchange')}</span>
          </div>
          <EnrolledNowSection
            plan={effectivePlan}
            failRates={failRates}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SubjectsPanelHeader
        creditsAcquired={effectivePlan.creditsAcquired}
        creditsRequired={effectivePlan.creditsRequired}
        studyStats={studyStats}
        plan={effectivePlan}
        zameraniProgress={zameraniProgress}
        enrolledCredits={enrolledCredits}
      />

      <div className="px-4 pt-3 pb-0 shrink-0">
        <EnrolledNowSection
          plan={effectivePlan}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
        <div className="mt-3">
          <StudyAveragesSection studyStats={studyStats} comparison={studyComparison} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 shrink-0">
        <button
          onClick={onOpenStudyPlan}
          className="btn btn-ghost btn-sm w-full justify-between text-base-content/60 font-medium"
        >
          <span>{t('subjects.studyPlan')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

Notes for the implementer:
- `useSubjectsData` accepts `StudyPlan | null` and is called unconditionally before any early return — hooks order is preserved.
- In the fallback branch, `subjectSemesters`/`subjectToZameranis` are intentionally not passed to `EnrolledNowSection` (they're empty maps for a synthetic plan; the props are optional).
- Do NOT add any data-fetching `useEffect` — the success-rate batch fetch already lives inside `useSubjectsData`.

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx vitest run src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full test suite, typecheck, lint, build**

Run: `npm run test:run && npm run typecheck && npm run lint && npm run build`
Expected: all exit 0. Pay attention to existing SubjectsPanel-adjacent tests (`StudyPlanPage*.test.tsx`, `StudyAveragesSection.test.tsx`) — they must still pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/SubjectsPanel/index.tsx src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(subjects): show enrolled subjects from list.pl when study plan is missing (Erasmus)"
```
