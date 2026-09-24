# Report Button Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put "Nahlásit" where IS-data problems show up: parser-fed empty states and failed exam actions. Each entry point opens the one report form with a prefilled title of our own.

**Architecture:** A new Zustand slice (`openReport` / `closeReport`) replaces the desktop `useState` and the phone tree's local modal. `FeedbackModalHost` reads it and is mounted once per tree. Two shared pieces feed the entry points:

- `ReportMissingLink` — a quiet link-button for empty states
- `reportToastOptions` — the sonner action for failure toasts

**Tech Stack:** React 19, Zustand slices, DaisyUI/Tailwind, sonner 2.x, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-24-report-button-placement-design.md`

## Global Constraints

- **Payload:** nothing new is transmitted. `src/api/suggestions.ts` and the `submit_suggestion` payload are unchanged. `src/test/guards/noStudentDataLeaves.test.ts` passes **unmodified**.
- **Prefill source:** prefilled titles come from our own i18n keys only, never from `res.error`, `errorMessage` or any other IS-derived text.
- **Strings:** every new key goes in both `src/i18n/locales/cs.json` and `en.json`.
- **Styling:** DaisyUI semantic classes plus Tailwind utilities, and no custom CSS. Muted text is `text-base-content/70`, never lower on text. The empty-state link has no error color.
- **Touch target:** ≥ 44 px on the link (`min-h-11`).
- **Test first:** no `localStorage`, and no `useEffect` for data. Write the failing test before each implementation step.
- **Untouched:** no parser file changes, and nothing under `src/components/MobileNav/`. That folder is dead code: nothing imports `MobileBottomNav`, and it is the only renderer of `MobileProfileSheet`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PR:** base it on `test` (`gh pr create --base test`), and only when Dominik asks to ship.

## File map

| File | Responsibility |
|---|---|
| `src/store/slices/createReportSlice.ts` (new) | `reportOpen`, `reportPrefill`, `reportSeq`, `openReport`, `closeReport` |
| `src/store/types.ts`, `src/store/useAppStore.ts` | compose the slice |
| `src/components/Feedback/FeedbackModal.tsx` | gains `initialTitle?: string` |
| `src/components/Feedback/FeedbackModalHost.tsx` (new) | store → `FeedbackModal`, remounted per open |
| `src/components/Feedback/reportPrefill.ts` (new) | `ReportPrefillKey` type + `reportToastOptions()` |
| `src/components/Feedback/ReportMissingLink.tsx` (new) | the empty-state link |
| `AppOverlays.tsx`, `App.tsx`, `hooks/useAppLogic.ts`, `Sidebar.tsx`, `Sidebar/BottomActions.tsx`, `Sidebar/ProfilePopup.tsx` | desktop: drop the `useState` + prop chain, mount the host |
| `mobile/MobileApp.tsx`, `mobile/screens/ProfileScreen.tsx` | phone: mount the host, drop the local modal |
| `ExamPanel/EmptyExamsState.tsx`, `SubjectsPanel/index.tsx`, `mobile/screens/ExamsScreen.tsx`, `mobile/screens/SubjectsScreen.tsx`, `SubjectFileDrawer/SyllabusTab.tsx`, `SubjectFileDrawer/ZaznamnikTab.tsx` | empty-state links |
| `ExamPanel/useExamActions.ts` (both trees), `mobile/screens/exams/TermRow.tsx` | failure-toast action |

---

### Task 1: Report slice

**Files:**
- Create: `src/store/slices/createReportSlice.ts`
- Modify: `src/store/types.ts` (the `AppState` intersection, near line 648)
- Modify: `src/store/useAppStore.ts` (imports near line 40, spread near line 87)
- Test: `src/store/slices/__tests__/createReportSlice.test.ts`

**Interfaces:**
- Produces:
  - `interface ReportPrefill { title: string }`
  - `interface ReportSlice { reportOpen: boolean; reportPrefill: ReportPrefill | null; reportSeq: number; openReport: (prefill?: ReportPrefill) => void; closeReport: () => void }`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/slices/__tests__/createReportSlice.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

afterEach(() => {
  useAppStore.setState({ reportOpen: false, reportPrefill: null });
});

describe('createReportSlice', () => {
  it('starts closed with no prefill', () => {
    expect(useAppStore.getState()).toMatchObject({ reportOpen: false, reportPrefill: null });
  });

  it('openReport opens with the prefill and bumps the sequence', () => {
    const before = useAppStore.getState().reportSeq;
    useAppStore.getState().openReport({ title: 'Zkoušky: prázdný seznam' });
    expect(useAppStore.getState()).toMatchObject({
      reportOpen: true,
      reportPrefill: { title: 'Zkoušky: prázdný seznam' },
      reportSeq: before + 1,
    });
  });

  it('a plain openReport has no prefill', () => {
    useAppStore.getState().openReport();
    expect(useAppStore.getState().reportPrefill).toBeNull();
  });

  // A toast's "Nahlásit" sits above the modal's backdrop. Pressing it while the
  // form is open must not remount the form and wipe what the student typed.
  it('is a no-op while the form is already open', () => {
    useAppStore.getState().openReport({ title: 'A' });
    const seq = useAppStore.getState().reportSeq;
    useAppStore.getState().openReport({ title: 'B' });
    expect(useAppStore.getState().reportSeq).toBe(seq);
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'A' });
  });

  it('closeReport closes and clears the prefill', () => {
    useAppStore.getState().openReport({ title: 'A' });
    useAppStore.getState().closeReport();
    expect(useAppStore.getState()).toMatchObject({ reportOpen: false, reportPrefill: null });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/store/slices/__tests__/createReportSlice.test.ts`
Expected: FAIL, because `openReport` is not a function.

- [ ] **Step 3: Implement the slice and compose it**

```ts
// src/store/slices/createReportSlice.ts
import type { AppSlice } from '../types';

/** Our own string only — never IS text, which can carry studium=/predmet= data. */
export interface ReportPrefill {
  title: string;
}

export interface ReportSlice {
  reportOpen: boolean;
  reportPrefill: ReportPrefill | null;
  /** Bumps on every open; the host keys the form on it so each open starts fresh. */
  reportSeq: number;
  openReport: (prefill?: ReportPrefill) => void;
  closeReport: () => void;
}

export const createReportSlice: AppSlice<ReportSlice> = (set, get) => ({
  reportOpen: false,
  reportPrefill: null,
  reportSeq: 0,
  openReport: (prefill) => {
    if (get().reportOpen) return;
    set((s) => ({ reportOpen: true, reportPrefill: prefill ?? null, reportSeq: s.reportSeq + 1 }));
  },
  closeReport: () => set({ reportOpen: false, reportPrefill: null }),
});
```

In `src/store/types.ts`, add a line to the `AppState` intersection just before `DemoSlice;`:

```ts
  import('./slices/createSuggestionsSlice').SuggestionsSlice &
  import('./slices/createReportSlice').ReportSlice &
  DemoSlice;
```

In `src/store/useAppStore.ts`, add the import after `createDemoSlice` and the spread after `...createDemoSlice(...a),`:

```ts
import { createReportSlice } from './slices/createReportSlice';
// …
  ...createReportSlice(...a),
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/store/slices/__tests__/createReportSlice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/createReportSlice.ts src/store/slices/__tests__/createReportSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(feedback): a report slice any screen can open the form from

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One form per tree, opened from the store

**Files:**
- Modify: `src/components/Feedback/FeedbackModal.tsx:11-18` (props + initial title)
- Create: `src/components/Feedback/FeedbackModalHost.tsx`
- Modify:
  - `src/components/AppOverlays.tsx`
  - `src/App.tsx:61-66,80-85`
  - `src/hooks/useAppLogic.ts:61,389-390`
- Modify:
  - `src/components/Sidebar.tsx:12,20,93`
  - `src/components/Sidebar/BottomActions.tsx:7,66-73`
  - `src/components/Sidebar/ProfilePopup.tsx:15-23,142-150`
- Modify:
  - `src/components/mobile/MobileApp.tsx` (after `<SheetHost />`)
  - `src/components/mobile/screens/ProfileScreen.tsx:9,46,149-153,171`
- Test:
  - `src/components/Feedback/__tests__/FeedbackModalHost.test.tsx` (new)
  - `src/components/Sidebar/__tests__/ProfilePopup.test.tsx`
  - `src/components/mobile/screens/__tests__/ProfileScreen.test.tsx`

**Interfaces:**
- Consumes: `openReport`, `closeReport`, `reportOpen`, `reportPrefill` and `reportSeq` from Task 1.
- Produces:
  - `<FeedbackModalHost />`, which takes no props.
  - `FeedbackModal` props become `{ isOpen: boolean; onClose: () => void; initialTitle?: string }`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/Feedback/__tests__/FeedbackModalHost.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModalHost } from '../FeedbackModalHost';

vi.mock('../../../api/suggestions', () => ({ submitSuggestion: vi.fn() }));

beforeEach(() => {
  useAppStore.setState({ language: 'en', reportOpen: false, reportPrefill: null });
});
afterEach(cleanup);

describe('FeedbackModalHost', () => {
  it('renders nothing while closed', () => {
    render(<FeedbackModalHost />);
    expect(screen.queryByPlaceholderText(/Briefly describe/i)).toBeNull();
  });

  it('opens with the prefilled title as a bug', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport({ title: 'Exams: list is empty' }));
    expect(screen.getByPlaceholderText(/Briefly describe/i)).toHaveValue('Exams: list is empty');
    expect(screen.getByRole('button', { name: /Bug/ })).toHaveClass('bg-error/20');
  });

  it('starts fresh on the next open instead of keeping the last prefill', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport({ title: 'Exams: list is empty' }));
    act(() => useAppStore.getState().closeReport());
    act(() => useAppStore.getState().openReport());
    expect(screen.getByPlaceholderText(/Briefly describe/i)).toHaveValue('');
  });

  it('closing the form closes the store state', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(useAppStore.getState().reportOpen).toBe(false);
  });
});
```

Append this to `src/components/Sidebar/__tests__/ProfilePopup.test.tsx`:

```tsx
describe('ProfilePopup — report a problem', () => {
  it('opens the report form from the store and closes the popup', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null });
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Report Bug/i }));
    expect(useAppStore.getState().reportOpen).toBe(true);
    expect(useAppStore.getState().reportPrefill).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});
```

Append this inside the `describe('the profile tab', …)` block of `src/components/mobile/screens/__tests__/ProfileScreen.test.tsx`:

```tsx
  it('opens the one shared report form, not a local copy', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null } as never);
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Nahlásit chybu/ }));
    expect(useAppStore.getState().reportOpen).toBe(true);
    // The form itself is mounted by MobileApp, not by this screen.
    expect(screen.queryByPlaceholderText(/Stručně popiš/)).toBeNull();
  });
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/Feedback/__tests__/FeedbackModalHost.test.tsx src/components/Sidebar/__tests__/ProfilePopup.test.tsx src/components/mobile/screens/__tests__/ProfileScreen.test.tsx`
Expected:
- **Host test:** FAIL, because the module `../FeedbackModalHost` doesn't exist yet.
- **ProfilePopup test:** FAIL, because the button isn't found. It renders only when `onOpenFeedback` is passed.
- **ProfileScreen test:** FAIL. `reportOpen` stays false, and the local modal renders.

- [ ] **Step 3: Implement**

In `FeedbackModal.tsx`, change the props and the title's initial state:

```tsx
interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Our own prefill (an entry point's key), never IS text. Read once per mount. */
  initialTitle?: string;
}

export function FeedbackModal({ isOpen, onClose, initialTitle }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'idea' | 'other'>('bug');
  const [title, setTitle] = useState(initialTitle ?? '');
```

Create `src/components/Feedback/FeedbackModalHost.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { FeedbackModal } from './FeedbackModal';

/**
 * The one report form per tree. Keyed on `reportSeq` so every open mounts a
 * fresh form: the prefill is read as initial state, and a draft from an
 * earlier open never leaks into a report about something else.
 */
export function FeedbackModalHost() {
  const reportOpen = useAppStore((s) => s.reportOpen);
  const reportSeq = useAppStore((s) => s.reportSeq);
  const reportPrefill = useAppStore((s) => s.reportPrefill);
  const closeReport = useAppStore((s) => s.closeReport);
  return (
    <FeedbackModal
      key={reportSeq}
      isOpen={reportOpen}
      onClose={closeReport}
      initialTitle={reportPrefill?.title}
    />
  );
}
```

`AppOverlays.tsx`:
- Remove `isFeedbackOpen` / `setIsFeedbackOpen` from the props interface and the destructure.
- Replace the `FeedbackModal` import with `import { FeedbackModalHost } from './Feedback/FeedbackModalHost';`.
- Replace the element with `<FeedbackModalHost />`.

`App.tsx`:
- Delete `onOpenFeedback={() => s.setIsFeedbackOpen(true)}` from `<Sidebar>`.
- Delete the `isFeedbackOpen` / `setIsFeedbackOpen` props from `<AppOverlays>`.

`useAppLogic.ts`:
- Delete `const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);`.
- Delete the two return-object entries.

`Sidebar.tsx`:
- Delete `onOpenFeedback?: () => void;` from `SidebarProps`.
- Delete it from the destructure.
- Render `<BottomActions />`.

`BottomActions.tsx`:
- The signature becomes `export function BottomActions() {`.
- `<ProfilePopup>` loses its `onOpenFeedback` prop and keeps `isOpen` and `onClose={() => setIsOpen(false)}`.

`ProfilePopup.tsx`:
- Remove `onOpenFeedback` from the props type and the destructure.
- Add `const openReport = useAppStore((state) => state.openReport);` next to the other store reads.
- Replace the conditional block at lines 142–150 with an unconditional button:

```tsx
          <button
            onClick={() => {
              onClose?.();
              openReport();
            }}
            className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors"
          >
            <MessageSquarePlus size={16} className="text-base-content/50" />
            <span className="text-xs font-medium opacity-70">{t('settings.reportBug')}</span>
          </button>
```

`MobileApp.tsx`:
- Add `import { FeedbackModalHost } from '../Feedback/FeedbackModalHost';`.
- Render `<FeedbackModalHost />` directly after `<SheetHost />`.

`ProfileScreen.tsx`:
- Delete the `FeedbackModal` import, the `feedbackOpen` state and the `<FeedbackModal …/>` element.
- Add `const openReport = useAppStore((s) => s.openReport);`.
- Change the row's handler to `onClick={() => openReport()}`.
- In the doc comment, replace "`FeedbackModal`" with "the shared report form (mounted by `MobileApp`)".

- [ ] **Step 4: Run them and confirm they pass**

Run:
- `npx vitest run src/components/Feedback src/components/Sidebar src/components/__tests__/Sidebar.test.tsx src/components/mobile/screens/__tests__/ProfileScreen*.test.tsx src/components/mobile/__tests__/MobileApp.test.tsx src/store/slices/__tests__/createReportSlice.test.ts`
- then `npm run typecheck`

Expected: all PASS. Typecheck shows no remaining reference to `isFeedbackOpen` or `onOpenFeedback` outside `src/components/MobileNav/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Feedback src/components/AppOverlays.tsx src/App.tsx src/hooks/useAppLogic.ts src/components/Sidebar.tsx src/components/Sidebar src/components/mobile/MobileApp.tsx src/components/mobile/screens/ProfileScreen.tsx src/components/mobile/screens/__tests__/ProfileScreen.test.tsx
git commit -m "refactor(feedback): one report form per tree, opened from the store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Strings, the empty-state link, the toast action

**Files:**
- Modify: `src/i18n/locales/cs.json` and `src/i18n/locales/en.json` (inside `"feedback"`, after `"toastRateLimited"`)
- Create:
  - `src/components/Feedback/reportPrefill.ts`
  - `src/components/Feedback/ReportMissingLink.tsx`
- Test:
  - `src/i18n/__tests__/feedbackReportKeys.test.ts`
  - `src/components/Feedback/__tests__/ReportMissingLink.test.tsx`
  - `src/components/Feedback/__tests__/reportPrefill.test.ts`

**Interfaces:**
- Consumes: `openReport` from Task 1.
- Produces:
  - `type ReportPrefillKey = 'examsEmpty' | 'subjectsEmpty' | 'syllabusEmpty' | 'zaznamnikEmpty' | 'examActionFailed'`
  - `REPORT_TOAST_DURATION_MS = 10_000`
  - `reportToastOptions(t: (key: string) => string, prefill: ReportPrefillKey): { duration: number; action: { label: string; onClick: () => void } }`
  - `<ReportMissingLink prefill={ReportPrefillKey} className?: string />`

- [ ] **Step 1: Write the failing tests**

```ts
// src/i18n/__tests__/feedbackReportKeys.test.ts
import { describe, it, expect } from 'vitest';
import cs from '../locales/cs.json';
import en from '../locales/en.json';

const KEYS = ['reportLink', 'reportAction'];
const PREFILLS = ['examsEmpty', 'subjectsEmpty', 'syllabusEmpty', 'zaznamnikEmpty', 'examActionFailed'];

describe('report entry-point strings', () => {
  for (const [name, locale] of [['cs', cs], ['en', en]] as const) {
    const fb = (locale as Record<string, Record<string, unknown>>).feedback;
    it(`${name} has every link/action key`, () => {
      for (const k of KEYS) expect(fb[k], k).toEqual(expect.any(String));
    });
    // The exact title is the measurement bucket (reports are grouped by it),
    // so every entry point's title must exist and differ from the others.
    it(`${name} has a distinct prefill title per entry point`, () => {
      const prefill = fb.prefill as Record<string, string>;
      const titles = PREFILLS.map((k) => prefill[k]);
      for (const t of titles) expect(t).toMatch(/^[^:]+: \S/);
      expect(new Set(titles).size).toBe(PREFILLS.length);
    });
  }
});
```

```tsx
// src/components/Feedback/__tests__/ReportMissingLink.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ReportMissingLink } from '../ReportMissingLink';

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

describe('ReportMissingLink', () => {
  it('reads as a question, not an error', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    expect(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeInTheDocument();
  });

  it('opens the report form prefilled with its own section title', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    fireEvent.click(screen.getByRole('button'));
    expect(useAppStore.getState()).toMatchObject({
      reportOpen: true,
      reportPrefill: { title: 'Zkoušky: prázdný seznam' },
    });
  });

  it('has a phone-sized touch target', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });
});
```

```ts
// src/components/Feedback/__tests__/reportPrefill.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { translate } from '../../../i18n/translate';
import { reportToastOptions, REPORT_TOAST_DURATION_MS } from '../reportPrefill';

const t = (key: string) => translate('en', key);

beforeEach(() => useAppStore.setState({ reportOpen: false, reportPrefill: null }));

describe('reportToastOptions', () => {
  it('keeps the toast up long enough to press Report', () => {
    expect(reportToastOptions(t, 'examActionFailed').duration).toBe(REPORT_TOAST_DURATION_MS);
    expect(REPORT_TOAST_DURATION_MS).toBe(10_000);
  });

  it('labels the action and opens the form with our own title', () => {
    const { action } = reportToastOptions(t, 'examActionFailed');
    expect(action.label).toBe('Report');
    action.onClick();
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Exams: action failed' });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/i18n/__tests__/feedbackReportKeys.test.ts src/components/Feedback/__tests__/ReportMissingLink.test.tsx src/components/Feedback/__tests__/reportPrefill.test.ts`
Expected:
- **Keys test:** FAIL, because the keys are undefined.
- **Link and toast-option tests:** FAIL, because their modules don't exist yet.

- [ ] **Step 3: Implement**

In `cs.json`, inside `"feedback"`, after `"toastRateLimited": …`:

```json
    "reportLink": "Chybí tu něco? Nahlásit",
    "reportAction": "Nahlásit",
    "prefill": {
      "examsEmpty": "Zkoušky: prázdný seznam",
      "subjectsEmpty": "Předměty: prázdný seznam",
      "syllabusEmpty": "Sylabus: chybí data",
      "zaznamnikEmpty": "Záznamník: chybí data",
      "examActionFailed": "Zkoušky: akce selhala"
    }
```

In `en.json`, same place:

```json
    "reportLink": "Something missing? Report it",
    "reportAction": "Report",
    "prefill": {
      "examsEmpty": "Exams: list is empty",
      "subjectsEmpty": "Subjects: list is empty",
      "syllabusEmpty": "Syllabus: no data",
      "zaznamnikEmpty": "Records: no data",
      "examActionFailed": "Exams: action failed"
    }
```

(Add a comma after the preceding `"toastRateLimited"` value in both files.)

```ts
// src/components/Feedback/reportPrefill.ts
import { useAppStore } from '../../store/useAppStore';

/**
 * One key per entry point. Reports are counted per entry point by grouping
 * `suggestions` on the exact title, so every resolved title must be distinct.
 */
export type ReportPrefillKey =
  | 'examsEmpty'
  | 'subjectsEmpty'
  | 'syllabusEmpty'
  | 'zaznamnikEmpty'
  | 'examActionFailed';

export const REPORT_TOAST_DURATION_MS = 10_000;

/**
 * Options for a failure toast that offers to report it. The prefill is our own
 * string, never the toast's text: an IS error message can carry student data.
 */
export function reportToastOptions(t: (key: string) => string, prefill: ReportPrefillKey) {
  return {
    duration: REPORT_TOAST_DURATION_MS,
    action: {
      label: t('feedback.reportAction'),
      onClick: () =>
        useAppStore.getState().openReport({ title: t(`feedback.prefill.${prefill}`) }),
    },
  };
}
```

```tsx
// src/components/Feedback/ReportMissingLink.tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReportPrefillKey } from './reportPrefill';

/**
 * The quiet "something missing?" under an empty state fed by parsed IS data.
 * A broken parser renders a believable empty list rather than an error, so
 * this is where a student notices. Worded as a question because empty is
 * usually correct; never error-coloured.
 */
export function ReportMissingLink({
  prefill,
  className = '',
}: {
  prefill: ReportPrefillKey;
  className?: string;
}) {
  const { t } = useTranslation();
  const openReport = useAppStore((s) => s.openReport);
  return (
    <button
      type="button"
      onClick={() => openReport({ title: t(`feedback.prefill.${prefill}`) })}
      className={`btn btn-link btn-sm min-h-11 h-auto font-normal text-base-content/70 no-underline hover:underline ${className}`}
    >
      {t('feedback.reportLink')}
    </button>
  );
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: the Step 2 command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json src/i18n/__tests__/feedbackReportKeys.test.ts src/components/Feedback/reportPrefill.ts src/components/Feedback/ReportMissingLink.tsx src/components/Feedback/__tests__/ReportMissingLink.test.tsx src/components/Feedback/__tests__/reportPrefill.test.ts
git commit -m "feat(feedback): report link and toast action, prefilled with our own titles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Links on the six parser-fed empty states

**Files:**
- Modify:
  - `src/components/ExamPanel/EmptyExamsState.tsx`
  - `src/components/SubjectsPanel/index.tsx:66-70`
  - `src/components/mobile/screens/ExamsScreen.tsx:166-173`
  - `src/components/mobile/screens/SubjectsScreen.tsx:29-40`
  - `src/components/SubjectFileDrawer/SyllabusTab.tsx:43-49`
  - `src/components/SubjectFileDrawer/ZaznamnikTab.tsx:77-89,117-122`
- Test:
  - `src/components/ExamPanel/__tests__/EmptyExamsState.test.tsx` (new)
  - `src/components/SubjectFileDrawer/__tests__/SyllabusTab.report.test.tsx` (new)
  - `src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx`
  - `src/components/mobile/screens/__tests__/ExamsScreen.test.tsx`
  - `src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx`
  - `src/components/SubjectFileDrawer/__tests__/ZaznamnikTab.test.tsx`

**Interfaces:**
- Consumes: `<ReportMissingLink prefill=… />` from Task 3.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ExamPanel/__tests__/EmptyExamsState.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EmptyExamsState } from '../EmptyExamsState';

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

it('offers to report a missing exam list', () => {
  render(<EmptyExamsState />);
  fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
  expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Zkoušky: prázdný seznam' });
});
```

```tsx
// src/components/SubjectFileDrawer/__tests__/SyllabusTab.report.test.tsx
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SyllabusTab } from '../SyllabusTab';

vi.mock('../../../hooks/data', () => ({
  useSyllabus: () => ({ syllabus: null, isLoading: false }),
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

it('offers to report an empty syllabus, outside the faded empty text', () => {
  render(<SyllabusTab courseCode="EBC-ALG" />);
  const link = screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' });
  // opacity-40 on an ancestor would drop the link below 4.5:1 contrast.
  expect(link.closest('.opacity-40')).toBeNull();
  fireEvent.click(link);
  expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Sylabus: chybí data' });
});
```

Append this to `SubjectsPanel.fallback.test.tsx`, after the "still shows the noData empty state" test:

```tsx
  it('offers to report the missing study plan from the noData state', () => {
    setStore({ plan: null, subjects: null });
    useAppStore.setState({ reportOpen: false, reportPrefill: null });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Something missing? Report it' }));
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Subjects: list is empty' });
  });
```

(Add `fireEvent` to that file's `@testing-library/react` import if it isn't there.)

Append this to `ExamsScreen.test.tsx`, after "renders the empty state when there are no exams":

```tsx
  it('offers to report from the empty state', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null } as never);
    render(<ExamsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Zkoušky: prázdný seznam' });
  });
```

Append this to `SubjectsScreen.test.tsx`, after "renders the empty state with no study plan":

```tsx
  it('offers to report from the empty state', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null } as never);
    render(<SubjectsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Předměty: prázdný seznam' });
  });
```

Append this to `ZaznamnikTab.test.tsx`, adding `fireEvent` to its import:

```tsx
describe('ZaznamnikTab report link', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      reportOpen: false,
      reportPrefill: null,
    } as never);
  });
  afterEach(cleanup);

  it('offers to report when a subject with assessment has no records', () => {
    useAppStore.setState({
      subjects: { data: { EBC: { hasPrubezne: true, hasTest: true, subjectId: '789' } } },
    } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Záznamník: chybí data' });
  });

  it('stays quiet for a subject that has no assessment at all', () => {
    useAppStore.setState({
      subjects: { data: { EBC: { hasPrubezne: false, hasTest: false, subjectId: '789' } } },
    } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/ExamPanel/__tests__/EmptyExamsState.test.tsx src/components/SubjectFileDrawer/__tests__/SyllabusTab.report.test.tsx src/components/SubjectsPanel/__tests__/SubjectsPanel.fallback.test.tsx src/components/mobile/screens/__tests__/ExamsScreen.test.tsx src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx src/components/SubjectFileDrawer/__tests__/ZaznamnikTab.test.tsx`
Expected: the new tests FAIL, because the button isn't found. "Stays quiet" passes already.

- [ ] **Step 3: Implement**

Each file imports `ReportMissingLink` from its own relative path to `components/Feedback/ReportMissingLink`:

| File | Import path |
|---|---|
| `ExamPanel/EmptyExamsState.tsx` | `'../Feedback/ReportMissingLink'` |
| `SubjectsPanel/index.tsx` | `'../Feedback/ReportMissingLink'` |
| `mobile/screens/ExamsScreen.tsx` | `'../../Feedback/ReportMissingLink'` |
| `mobile/screens/SubjectsScreen.tsx` | `'../../Feedback/ReportMissingLink'` |
| `SubjectFileDrawer/SyllabusTab.tsx` | `'../Feedback/ReportMissingLink'` |
| `SubjectFileDrawer/ZaznamnikTab.tsx` | `'../Feedback/ReportMissingLink'` |

`EmptyExamsState.tsx`: after the subtitle `<p>`, add

```tsx
      <ReportMissingLink prefill="examsEmpty" className="mt-3" />
```

`SubjectsPanel/index.tsx`: replace the noData return with

```tsx
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-base-content/70">
        <p>{t('subjects.noData')}</p>
        <ReportMissingLink prefill="subjectsEmpty" />
      </div>
    );
```

`ExamsScreen.tsx`: after `<div className="max-w-56 text-sm text-base-content/60">{t('mobile.exams.emptyBody')}</div>`, add

```tsx
          <ReportMissingLink prefill="examsEmpty" />
```

`SubjectsScreen.tsx` (`EmptyState`): after the `mobile.subjects.emptyBody` div, add

```tsx
      <ReportMissingLink prefill="subjectsEmpty" />
```

`SyllabusTab.tsx`: replace the empty return with this. The fade moves to an inner wrapper so the link keeps full contrast:

```tsx
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="flex flex-col items-center opacity-40">
          <BookOpen className="w-12 h-12 mb-3" />
          <p className="text-sm">{t('syllabus.noData')}</p>
        </div>
        <ReportMissingLink prefill="syllabusEmpty" className="mt-2" />
      </div>
    );
```

`ZaznamnikTab.tsx`, first empty branch (the `!data || …` block). Replace the inner faded div with this. The link shows only when `hasFlags`:

```tsx
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="flex flex-col items-center opacity-40">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {hasFlags ? t('zaznamnik.noData') : t('zaznamnik.noAssessment')}
            </p>
          </div>
          {hasFlags && <ReportMissingLink prefill="zaznamnikEmpty" className="mt-2" />}
        </div>
```

`ZaznamnikTab.tsx`, second empty block (`nonEmptyArches.length === 0 && vtGroups.length === 0`):

```tsx
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="flex flex-col items-center opacity-40">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-sm">{t('zaznamnik.noData')}</p>
          </div>
          <ReportMissingLink prefill="zaznamnikEmpty" className="mt-2" />
        </div>
```

- [ ] **Step 4: Run them and confirm they pass**

Run: the Step 2 command.
Expected: every test PASSES, including the ones that were already there.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExamPanel src/components/SubjectsPanel src/components/mobile/screens/ExamsScreen.tsx src/components/mobile/screens/SubjectsScreen.tsx src/components/mobile/screens/__tests__/ExamsScreen.test.tsx src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx src/components/SubjectFileDrawer
git commit -m "feat(feedback): ask \"something missing?\" where parsed IS data comes back empty

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Nahlásit" on failed exam actions

**Files:**
- Modify:
  - `src/components/ExamPanel/useExamActions.ts:26,41,44,48,50,54,63,64`
  - `src/components/mobile/screens/exams/TermRow.tsx:34`
- Test:
  - `src/components/ExamPanel/__tests__/useExamActions.test.ts`
  - `src/components/mobile/screens/exams/__tests__/TermRow.test.tsx`

**Interfaces:**
- Consumes: `reportToastOptions(t, 'examActionFailed')` from Task 3.

- [ ] **Step 1: Write the failing tests**

In `useExamActions.test.ts`:

1. Add `mockOpenReport: vi.fn()` to the `vi.hoisted` object and to its destructure (`const { mockSetExams, mockFetchExams, mockTriggerExamsRefresh, mockOpenReport } = vi.hoisted(…)`). Then add `language: 'en'` and `openReport: mockOpenReport` to `mockState` in the store mock.
2. Add `import { toast } from 'sonner';` at the top.
3. Inside `describe('Error Handling', …)`, add:

```ts
    it('offers Report on a failed registration, prefilled with our title, never the IS text', async () => {
      vi.mocked(examsAPI.registerExam).mockResolvedValue({
        success: false,
        error: 'Termín EBC-ALG studium=123 je plný',
      });
      const { result } = renderHook(() =>
        useExamActions({ exams: mockExams, setExpandedSectionId: mockSetExpandedSectionId })
      );
      await act(async () => {
        await result.current.handleRegisterDirect(mockExams[0].sections[0], 'term-1');
      });

      const [text, opts] = vi.mocked(toast.error).mock.calls[0] as [string, { duration: number; action: { label: string; onClick: () => void } }];
      expect(text).toBe('Termín EBC-ALG studium=123 je plný');
      expect(opts.duration).toBe(10_000);
      expect(opts.action.label).toBe('Report');
      opts.action.onClick();
      expect(mockOpenReport).toHaveBeenCalledWith({ title: 'Exams: action failed' });
    });

    it('offers Report when unregistering has no term id', async () => {
      const { result } = renderHook(() =>
        useExamActions({ exams: mockExams, setExpandedSectionId: mockSetExpandedSectionId })
      );
      act(() => {
        result.current.handleUnregisterRequest({ ...mockExams[0].sections[0], registeredTerm: undefined });
      });
      await act(async () => {
        await result.current.handleConfirmAction();
      });
      expect(vi.mocked(toast.error).mock.calls[0][1]).toMatchObject({ duration: 10_000 });
    });
```

In `TermRow.test.tsx`, update the two `'failed'` assertions to the two-argument form, and add one test:

```tsx
    expect(toast.error).toHaveBeenCalledWith('Session expired', expect.objectContaining({ duration: 10_000 }));
    // …
    expect(toast.error).toHaveBeenCalledWith('Hlídače se nepodařilo aktivovat.', expect.objectContaining({ duration: 10_000 }));
```

```tsx
  it('offers Nahlásit on a failed toggle, prefilled with our own title', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null } as never);
    mockedUseWatchdog.mockReturnValue({ ...baseHookState(), feedback: 'failed', errorMessage: 'IS says no' });
    render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
    const opts = vi.mocked(toast.error).mock.calls[0][1] as { action: { label: string; onClick: () => void } };
    expect(opts.action.label).toBe('Nahlásit');
    opts.action.onClick();
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Zkoušky: akce selhala' });
  });
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/ExamPanel/__tests__/useExamActions.test.ts src/components/mobile/screens/exams/__tests__/TermRow.test.tsx`
Expected: FAIL. `opts` is undefined because `toast.error` is still called with one argument.

- [ ] **Step 3: Implement**

`useExamActions.ts`:
- Add `import { reportToastOptions } from '../Feedback/reportPrefill';`.
- After `const { t: tr } = useTranslation();`, add:

```ts
    // Every failure toast here offers "Nahlásit". The prefill is our own
    // title; the toast text may still show IS's own message.
    const report = () => reportToastOptions(tr, 'examActionFailed');
```

Then pass `report()` as the second argument to **every** `toast.error(…)` in the file (lines 26, 41, 44, 48, 50, 54, 63, 64). For example:

```ts
toast.error(tr('exams.actionUnregisterFailed'), report());
toast.error(res.error || tr('exams.actionFailed'), report());
if (!sec.registeredTerm?.id) return toast.error(tr('exams.actionMissingId'), report());
```

`TermRow.tsx`:
- Add `import { reportToastOptions } from '../../../Feedback/reportPrefill';`.
- Change line 34 to:

```tsx
    else if (feedback === 'failed')
      toast.error(errorMessage || t('exams.watchdogFailed'), reportToastOptions(t, 'examActionFailed'));
```

Leave `useAutoRegistration.ts` untouched. Its toasts report real conditions.

- [ ] **Step 4: Run them and confirm they pass**

Run: the Step 2 command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExamPanel/useExamActions.ts src/components/ExamPanel/__tests__/useExamActions.test.ts src/components/mobile/screens/exams/TermRow.tsx src/components/mobile/screens/exams/__tests__/TermRow.test.tsx
git commit -m "feat(feedback): failed exam actions offer Nahlásit for 10 s

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify end to end

- [ ] **Step 1: Run the gates CI runs, on the touched files**

```bash
npx vitest run src/store/slices/__tests__/createReportSlice.test.ts src/components/Feedback src/components/Sidebar src/components/__tests__/Sidebar.test.tsx src/components/mobile src/components/ExamPanel src/components/SubjectsPanel src/components/SubjectFileDrawer src/i18n src/test/guards/noStudentDataLeaves.test.ts
```

```bash
npm run typecheck
```

```bash
npx eslint src/store src/components/Feedback src/components/Sidebar src/components/ExamPanel src/components/SubjectsPanel src/components/SubjectFileDrawer src/components/mobile src/App.tsx src/components/AppOverlays.tsx src/hooks/useAppLogic.ts
```

```bash
npx prettier --check $(git diff --name-only origin/test...HEAD -- src)
```

Expected: all green. The privacy guard passes with the guard file unchanged, so `git diff origin/test -- src/test/guards` is empty. Read the full output of every command, not a `head` of it.

- [ ] **Step 2: Confirm no leftover wiring**

```bash
grep -rn "isFeedbackOpen\|onOpenFeedback" src | grep -v "src/components/MobileNav/"
```

Expected: no output.

- [ ] **Step 3: Check the UI visually**

Invoke the `verify-ui` skill. Take before (`origin/test`) and after screenshots at:
- **Phone tree:** 320, 390 and 430 px
- **Desktop tree:** its shipped widths

Do each in light and dark, for these surfaces:
- Zkoušky empty
- Předměty empty
- the Sylabus tab empty (subject drawer)
- the Záznamník tab empty

For each, assert:
- no horizontal overflow
- the link does not overlap the empty-state text
- link contrast is ≥ 4.5:1
- the link box is ≥ 44 px tall on the phone tree

Then click each link and confirm the form opens with its prefilled title on **both** trees. That proves the phone tree's `FeedbackModalHost` mount. Also open the form from the profile row in both trees.

- [ ] **Step 4: Send Dominik the evidence**

Use `SendUserFile` to send the before/after PNGs, unasked, before calling the work done.

- [ ] **Step 5: Ship only when asked**

When Dominik says ship: push the branch, run `gh pr create --base test`, and enable Auto-fix right after. The PR body includes the measurement SQL from the spec (grouped by exact title) and the baseline (15 reports / 5 weeks from ~3,760 installs, measured 2026-09-24).
