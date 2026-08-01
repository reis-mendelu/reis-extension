# reIS Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace reIS's thin responsive mode with a phone-native UI — five-tab bottom nav (Kalendář, Zkoušky, Předměty, Mapa, Student) plus a sheet family — built to the approved mobile prototype.

**Architecture:** Shell/content split. `App.tsx` branches once on a derived `isPhone`; `src/components/mobile/` owns screen scaffolds, navigation, sheets and primitives, while drawer tabs, map canvas, library and event components are imported unchanged from the desktop tree. Screen-specific derivations (`nowNext`, `dayAgenda`, `examTimeline`) are pure, unit-tested functions. Navigational state lives in one new Zustand slice; local disclosure state stays in `useState`.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Tailwind CSS 4 + DaisyUI 5, Vitest + happy-dom, Playwright, WXT.

**Spec:** `docs/superpowers/specs/2026-07-26-reis-mobile-design.md`
**Visual source of truth:** `docs/design/reIS-mobile-prototype.html` (line references throughout are to this file)

## How to read this plan

**Tasks 1–10 carry complete code.** These are the load-bearing pieces — the phone-detection rule, the store slice, the sheet primitive, the three derivations, the watchdog extraction — where a wrong guess is expensive and hard to spot later. Type them as written.

**Tasks 11–20 carry complete *interfaces*, complete *test obligations*, and exact prototype line ranges, but delegate the JSX itself.** This is deliberate: `docs/design/reIS-mobile-prototype.html` is vendored into the repo as the literal visual source of truth, and translating lines 89–159 into DaisyUI classes directly from that file produces a better result than working from a paraphrase of it. For each of these tasks: read the cited prototype range, write the listed failing test first, then build to it.

What is **not** negotiable in Tasks 11–20 is the interface block, the test obligations, and the Global Constraints below.

## Global Constraints

- **Zero parser changes.** `.claude/hooks/guard-parsers.py` runs `PreToolUse` on every `Edit|Write` and will block them. If it fires, the task is wrong, not the hook.
- **No custom CSS.** Use DaisyUI semantic classes (`bg-base-100`, `btn-primary`, `text-primary`). The design system's own header states: *"Source of truth: reis-mendelu/reis-extension tailwind + daisyUI theme… Prefer DaisyUI semantic classes in product code."*
  **Permitted exception:** inline `style` for values *computed from data at runtime* — progress-bar widths, conic-gradient stops, timeline offsets. Anything expressible as a class must be a class. This is a narrow carve-out, not a loophole.
- **`tailwind.config.js` is DEAD — never add design tokens there.** This repo runs Tailwind v4 via `@tailwindcss/vite`, and `src/index.css` has no `@config` directive, so the JS config generates nothing. Its `colors`, `boxShadow`, `fontFamily`, `transitionDuration` and `fontSize` blocks are all vestigial (a follow-up spec will retire them). New design tokens go in `src/index.css`'s `@theme` block, where Tailwind v4 auto-generates utilities from `--color-*`, `--font-*`, `--text-*`, `--shadow-*` variables.
- **Every screen task must do a live visual pass** — `npm run dev:web:mock` (sets `VITE_USE_MOCK_DATA=true`, seeding a separate `reis_db_mock` IndexedDB from `src/utils/mock/`), then `http://localhost:3000/?mobile=1` at 375×812. Two things to know or you will misread the screen: the standalone webapp has no content script, so the sync handshake resolves only via its **10-second timeout** — wait it out; and the mock dataset carries no student name, so name-dependent UI must degrade gracefully. This is the only way to see populated screens without scrape credentials, and it has already caught defects the unit tests could not — a single-point timeline clipped off the left edge, a dangling "Ahoj," greeting, and unlabelled avatar/bulletin buttons.
- **Verify new utility classes against COMPILED CSS, not source.** An invalid Tailwind class silently produces no rule at all, and `className`-string assertions in tests pass regardless. If a task introduces a utility not already used elsewhere in `src/`, run `npm run build` and grep the emitted bundle under `.output/` to prove the rule exists. Known-good and already verified: `text-2xs`, `font-display`, `shadow-card` / `shadow-popup` / `shadow-drawer`, `bg-base-100` / `-200` / `-300`.
- **Use `text-base-content`, NOT `text-content-*`, for general text.** `--color-content-primary/-secondary/-muted` are declared once in `@theme` with **light-theme values only** (`#111827` near-black) and are never overridden for `mendelu-dark`, the default theme. They exist for text on the *pale* event-card surfaces (`bg-lecture-bg`, `bg-exam-bg`, `bg-seminar-bg`) — which is their only pre-existing consumer, `CalendarEventCard.tsx`. Used as general text on a dark background they render near-black on near-black, and because `-muted` (#9ca3af) is *lighter* than `-primary`, the visual hierarchy inverts. Use DaisyUI's theme-aware `text-base-content`, `text-base-content/70`, `text-base-content/60` instead (732 uses elsewhere in the app). The compiled-CSS check does **not** catch this — the classes compile fine, they are simply the wrong colour. Tailwind's default `z-index` scale stops at 50 — use `z-[51]`, `z-[60]`, `z-[61]` for anything above it.
- **No `localStorage` / `sessionStorage`.** Use `IndexedDBService`.
- **No `useEffect` for data fetching.** Screens consume existing hooks; those hooks own their own fetching.
- **No proxy / re-export barrel files.** Import directly from the implementation file.
- **Max 200 lines per file.** Split proactively.
- **Test first.** Write the failing test, run it, watch it fail, then implement.
- **Every user-visible string goes through `t()`** with keys present in *both* `src/i18n/locales/cs.json` and `src/i18n/locales/en.json`.
- **Off-scale prototype sizes snap to the DS scale**: 13.5px → `text-sm` (14), 12.5px/11.5px → `text-xs` (12), 10px → `text-2xs`. Never add per-element pixel CSS.
- **No new code may assume `chrome.*` or the extension shell.** Mobile screens read from the store and hooks only. This keeps a future native wrapper an addition rather than a rewrite.
- **Branch:** all work lands on `claude/reis-mobile` and merges to `main` as one reviewed PR. Never merge a partial migration to `main`.
- **Commit after every task.** Run `npx eslint <changed files> --max-warnings=0` and `npm run typecheck` before each commit.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/utils/resolvePhoneViewport.ts` | Pure phone-viewport decision |
| `src/hooks/ui/usePhoneViewport.ts` | Store selector wrapping the above |
| `src/store/slices/createMobileUiSlice.ts` | Tab, selected day, sheet stack, map sheet state, dev override |
| `src/components/mobile/MobileApp.tsx` | Screen router + BottomNav + SheetHost + Toaster |
| `src/components/mobile/nav/BottomNav.tsx` | Five expanding pills |
| `src/components/mobile/primitives/Sheet.tsx` | Backdrop + slide-up container, two heights |
| `src/components/mobile/primitives/SheetHeader.tsx` | Drag handle + title + close |
| `src/components/mobile/sheets/SheetHost.tsx` | Renders the slice's sheet stack |
| `src/components/mobile/screens/*Screen.tsx` | Five screens |
| `src/components/mobile/screens/calendar/*` | NowNextCard, DayChips, DayAgenda, AgendaEvent, GapMarker |
| `src/components/mobile/screens/exams/*` | ExamTimeline, ExamGroup, ExamCard, TermRow |
| `src/components/mobile/screens/subjects/*` | CreditRing, SemesterCard, AverageAccordion |
| `src/components/mobile/screens/map/*` | MapSheet, FloorSwitcher |
| `src/components/mobile/screens/student/*` | StudentSearch, ShortcutGrid, PageGroupList |
| `src/utils/mobile/nowNext.ts` | Current + next lesson derivation |
| `src/utils/mobile/dayAgenda.ts` | Day rows with gap markers |
| `src/utils/mobile/examTimeline.ts` | Timeline points from registered terms |
| `src/hooks/data/useWatchdog.ts` | Shared watchdog arm/disarm cycle |

**Modified:** `src/App.tsx` (branch), `src/store/types.ts` (+`MobileUiSlice`), `src/store/useAppStore.ts` (compose slice), `src/index.css` (+`@font-face`), `tailwind.config.js` (+`display` family), `playwright.config.ts` (+`mobile-chromium`), `dev/main.web.tsx` (`?mobile=1`), `src/i18n/locales/{cs,en}.json`, `src/components/ExamPanel/TermBuiltinActions.tsx` (use extracted hook), `src/components/SubjectFileDrawer/SubjectFileDrawerContent.tsx` (extract tab body), `src/components/CampusMap/MapSidePanel.tsx` (extract sections).

---

### Task 1: i18n copy table (cs + en)

Mitigates spec risk R5 — English must not be back-filled as a machine gloss. Every later task consumes keys that already exist in both locales.

**Files:**
- Modify: `src/i18n/locales/cs.json`
- Modify: `src/i18n/locales/en.json`
- Test: `src/i18n/__tests__/mobileKeys.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `mobile.*` key namespace, used by every subsequent task via `const { t } = useTranslation()`.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/mobileKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import cs from '../locales/cs.json';
import en from '../locales/en.json';

/** Flattens {a:{b:'x'}} to ['a.b'] so key sets can be compared directly. */
function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, path)
      : [path];
  });
}

describe('mobile i18n namespace', () => {
  it('exists in both locales', () => {
    expect((cs as Record<string, unknown>).mobile).toBeDefined();
    expect((en as Record<string, unknown>).mobile).toBeDefined();
  });

  it('has identical key sets in cs and en', () => {
    const csKeys = flatten((cs as never)['mobile']).sort();
    const enKeys = flatten((en as never)['mobile']).sort();
    expect(enKeys).toEqual(csKeys);
  });

  it('has no empty strings', () => {
    const walk = (o: Record<string, unknown>): string[] =>
      Object.values(o).flatMap((v) =>
        v !== null && typeof v === 'object' ? walk(v as Record<string, unknown>) : [String(v)]
      );
    expect(walk((cs as never)['mobile']).filter((s) => s.trim() === '')).toEqual([]);
    expect(walk((en as never)['mobile']).filter((s) => s.trim() === '')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/__tests__/mobileKeys.test.ts`
Expected: FAIL — `expected undefined to be defined` on the first test.

- [ ] **Step 3: Add the `mobile` namespace to `cs.json`**

Add this top-level key to `src/i18n/locales/cs.json` (alongside the existing `calendar`, `exams`, … keys):

```json
"mobile": {
  "nav": {
    "calendar": "Kalendář",
    "exams": "Zkoušky",
    "subjects": "Předměty",
    "map": "Mapa",
    "student": "Student"
  },
  "calendar": {
    "greeting": "Ahoj, {name}",
    "nowRunning": "Teď běží",
    "endsIn": "konec za {minutes} min",
    "next": "Pak: {title}",
    "route": "Trasa →",
    "emptyTitle": "Nic nemáš, pohodička",
    "emptyBody": "Žádné přednášky ani cvičení. Užij si volno!",
    "gap": "{hours} h volno",
    "gapMinutes": "{minutes} min volno",
    "notifications": "Oznámení"
  },
  "exams": {
    "title": "Zkoušky",
    "registeredCount": "{count} přihlášeno",
    "groupUpcoming": "Nadcházející",
    "groupOther": "Ostatní",
    "register": "Přihlásit",
    "unregister": "Odhlásit",
    "yourTerm": "tvůj termín",
    "full": "obsazeno",
    "mates": "{count} spolužáků na tomto termínu",
    "matesNone": "Zatím nikdo ze spolužáků",
    "emptyTitle": "Žádné zkoušky",
    "emptyBody": "Až se objeví termíny, najdeš je tady."
  },
  "subjects": {
    "title": "Předměty",
    "studyPlan": "Studijní plán",
    "creditsOf": "{earned} / {total} kreditů",
    "currentSemester": "{n}. semestr",
    "running": "právě běží · {credits} kr.",
    "doneOf": "{done}/{total} hotovo",
    "average": "Studijní průměr",
    "avgSemester": "Tento semestr",
    "avgTotal": "Za celé studium",
    "avgWeighted": "Vážený průměr",
    "beats": "Překonáváš {pct} % studentů ve svém ročníku.",
    "topTier": "Jsi v top {pct} % ročníku.",
    "rank": "Pořadí v ročníku",
    "emptyTitle": "Zatím žádné předměty",
    "emptyBody": "Předměty se objeví po zápisu."
  },
  "map": {
    "searchPlaceholder": "Najdi místnost, budovu, akci…",
    "wholeCampus": "Celý kampus",
    "tabEvents": "Akce",
    "tabLibrary": "Knihovna",
    "tabBuilding": "Budova {name}",
    "peekHint": "Vytáhni pro události a rezervaci",
    "thisWeek": "Tenhle týden",
    "emptyTitle": "Mapa se nenačetla",
    "emptyBody": "Zkus to prosím znovu."
  },
  "student": {
    "title": "Student",
    "subtitle": "IS MENDELU v kapse",
    "tabPages": "Stránky IS",
    "tabPeople": "Lidé",
    "searchPages": "Hledej stránku v IS…",
    "searchPeople": "Hledej člověka…",
    "results": "Výsledky",
    "yourTeachers": "Tvoji vyučující",
    "noResults": "Nic jsme nenašli. Zkus to jinak.",
    "eduroam": "Eduroam",
    "eduroamSub": "Wi-Fi na 2 kliky",
    "documents": "Dokumenty",
    "documentsSub": "potvrzení o studiu",
    "erasmus": "Erasmus",
    "erasmusSub": "Learning Agreement",
    "iskam": "ISKAM",
    "iskamSub": "menza a koleje"
  },
  "sheet": {
    "close": "Zavřít",
    "cancel": "Radši ne"
  }
},
```

- [ ] **Step 4: Add the matching `mobile` namespace to `en.json`**

Add to `src/i18n/locales/en.json`, same structure, written as natural English rather than a gloss:

```json
"mobile": {
  "nav": {
    "calendar": "Calendar",
    "exams": "Exams",
    "subjects": "Courses",
    "map": "Map",
    "student": "Student"
  },
  "calendar": {
    "greeting": "Hi, {name}",
    "nowRunning": "On now",
    "endsIn": "ends in {minutes} min",
    "next": "Next: {title}",
    "route": "Directions →",
    "emptyTitle": "Nothing on — enjoy",
    "emptyBody": "No lectures or seminars today. Take the day.",
    "gap": "{hours} h free",
    "gapMinutes": "{minutes} min free",
    "notifications": "Notifications"
  },
  "exams": {
    "title": "Exams",
    "registeredCount": "{count} registered",
    "groupUpcoming": "Upcoming",
    "groupOther": "Other",
    "register": "Register",
    "unregister": "Unregister",
    "yourTerm": "your slot",
    "full": "full",
    "mates": "{count} classmates on this slot",
    "matesNone": "No classmates yet",
    "emptyTitle": "No exams",
    "emptyBody": "Slots will show up here once they open."
  },
  "subjects": {
    "title": "Courses",
    "studyPlan": "Study plan",
    "creditsOf": "{earned} / {total} credits",
    "currentSemester": "Semester {n}",
    "running": "in progress · {credits} cr.",
    "doneOf": "{done}/{total} done",
    "average": "Grade average",
    "avgSemester": "This semester",
    "avgTotal": "Whole degree",
    "avgWeighted": "Weighted average",
    "beats": "You're ahead of {pct}% of your year.",
    "topTier": "You're in the top {pct}% of your year.",
    "rank": "Rank in year",
    "emptyTitle": "No courses yet",
    "emptyBody": "Courses appear once you've enrolled."
  },
  "map": {
    "searchPlaceholder": "Find a room, building, event…",
    "wholeCampus": "Whole campus",
    "tabEvents": "Events",
    "tabLibrary": "Library",
    "tabBuilding": "Building {name}",
    "peekHint": "Pull up for events and booking",
    "thisWeek": "This week",
    "emptyTitle": "Map didn't load",
    "emptyBody": "Please try again."
  },
  "student": {
    "title": "Student",
    "subtitle": "IS MENDELU in your pocket",
    "tabPages": "IS pages",
    "tabPeople": "People",
    "searchPages": "Search IS pages…",
    "searchPeople": "Search people…",
    "results": "Results",
    "yourTeachers": "Your teachers",
    "noResults": "Nothing found. Try something else.",
    "eduroam": "Eduroam",
    "eduroamSub": "Wi-Fi in two taps",
    "documents": "Documents",
    "documentsSub": "proof of study",
    "erasmus": "Erasmus",
    "erasmusSub": "Learning Agreement",
    "iskam": "ISKAM",
    "iskamSub": "canteen and dorms"
  },
  "sheet": {
    "close": "Close",
    "cancel": "Not now"
  }
},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/i18n/__tests__/mobileKeys.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json src/i18n/__tests__/mobileKeys.test.ts
git commit -m "feat(mobile): add mobile i18n namespace with cs/en parity test"
```

---

### Task 2: `resolvePhoneViewport` pure function

Mitigates spec risk R1 — the phone decision must live in one tested place so the dev override and the E2E mount assertion have something to hang off.

**Files:**
- Create: `src/utils/resolvePhoneViewport.ts`
- Test: `src/utils/__tests__/resolvePhoneViewport.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolvePhoneViewport(input: PhoneViewportInput): boolean` where `PhoneViewportInput = { isTouch: boolean; isNarrow: boolean; override?: boolean | null }`. Task 4's `usePhoneViewport` calls it.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/resolvePhoneViewport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePhoneViewport } from '../resolvePhoneViewport';

describe('resolvePhoneViewport', () => {
  it('is a phone when touch and narrow', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true })).toBe(true);
  });

  it('is not a phone on a narrow desktop window (fine pointer)', () => {
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: true })).toBe(false);
  });

  it('is not a phone on a wide touch screen (tablet, kiosk)', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: false })).toBe(false);
  });

  it('override true forces the phone branch regardless of viewport', () => {
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: false, override: true })).toBe(true);
  });

  it('override false forces the desktop branch regardless of viewport', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: false })).toBe(false);
  });

  it('null and undefined override defer to the viewport', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: null })).toBe(true);
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: undefined })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/resolvePhoneViewport.test.ts`
Expected: FAIL — "Failed to resolve import ... resolvePhoneViewport".

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/resolvePhoneViewport.ts`:

```ts
export interface PhoneViewportInput {
    isTouch: boolean;
    isNarrow: boolean;
    /** Dev-only forced value. null/undefined defers to the viewport. */
    override?: boolean | null;
}

/**
 * Single source of truth for "is this a phone".
 *
 * Phone = coarse pointer AND narrow viewport, so a narrow desktop window stays
 * desktop and a tablet stays desktop. Kept pure and separate from the store so
 * it is testable without a DOM, and so the dev override has one place to apply.
 */
export function resolvePhoneViewport({ isTouch, isNarrow, override }: PhoneViewportInput): boolean {
    if (override === true || override === false) return override;
    return isTouch && isNarrow;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/resolvePhoneViewport.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolvePhoneViewport.ts src/utils/__tests__/resolvePhoneViewport.test.ts
git commit -m "feat(mobile): add resolvePhoneViewport pure decision function"
```

---

### Task 3: `createMobileUiSlice`

Owns navigational state only: active tab, selected day, the sheet stack, map sheet state, and the dev override. Local disclosure state (accordions) stays in `useState`.

**Files:**
- Create: `src/store/slices/createMobileUiSlice.ts`
- Modify: `src/store/types.ts`
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/slices/__tests__/createMobileUiSlice.test.ts`

**Interfaces:**
- Consumes: `AppSlice<T>` from `src/store/types.ts`.
- Produces: `MobileUiSlice` with fields `mobileTab`, `mobileSelectedDayIso`, `mobileSheets`, `mapSheetState`, `mapTab`, `devPhoneOverride` and actions `setMobileTab(tab)`, `setMobileSelectedDay(iso)`, `pushSheet(sheet)`, `popSheet()`, `replaceSheet(sheet)`, `closeAllSheets()`, `setMapSheetState(state)`, `setMapTab(tab)`, `setDevPhoneOverride(value)`.

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/__tests__/createMobileUiSlice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';

describe('createMobileUiSlice', () => {
    let state: MobileUiSlice;
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        set = vi.fn((updater) => {
            const patch = typeof updater === 'function' ? updater(state) : updater;
            state = { ...state, ...patch };
        });
        get = vi.fn(() => state);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = createMobileUiSlice(set, get, {} as any);
    });

    it('defaults to the calendar tab with no sheets open', () => {
        expect(state.mobileTab).toBe('calendar');
        expect(state.mobileSheets).toEqual([]);
        expect(state.mapSheetState).toBe('peek');
        expect(state.mapTab).toBe('akce');
        expect(state.devPhoneOverride).toBeNull();
    });

    it('setMobileTab switches the tab', () => {
        state.setMobileTab('exams');
        expect(state.mobileTab).toBe('exams');
    });

    it('pushSheet stacks sheets in order', () => {
        state.pushSheet({ kind: 'profile' });
        state.pushSheet({ kind: 'person', personId: 'p1' });
        expect(state.mobileSheets.map((s) => s.kind)).toEqual(['profile', 'person']);
    });

    it('popSheet removes only the topmost sheet', () => {
        state.pushSheet({ kind: 'profile' });
        state.pushSheet({ kind: 'person', personId: 'p1' });
        state.popSheet();
        expect(state.mobileSheets.map((s) => s.kind)).toEqual(['profile']);
    });

    it('popSheet on an empty stack is a no-op', () => {
        state.popSheet();
        expect(state.mobileSheets).toEqual([]);
    });

    it('replaceSheet swaps the topmost sheet without growing the stack', () => {
        state.pushSheet({ kind: 'profile' });
        state.replaceSheet({ kind: 'eduroam' });
        expect(state.mobileSheets.map((s) => s.kind)).toEqual(['eduroam']);
    });

    it('closeAllSheets empties the stack', () => {
        state.pushSheet({ kind: 'profile' });
        state.pushSheet({ kind: 'docs' });
        state.closeAllSheets();
        expect(state.mobileSheets).toEqual([]);
    });

    it('switching tabs closes any open sheets', () => {
        state.pushSheet({ kind: 'profile' });
        state.setMobileTab('map');
        expect(state.mobileSheets).toEqual([]);
    });

    it('tracks map sheet state and tab', () => {
        state.setMapSheetState('expanded');
        state.setMapTab('knihovna');
        expect(state.mapSheetState).toBe('expanded');
        expect(state.mapTab).toBe('knihovna');
    });

    it('stores the dev phone override', () => {
        state.setDevPhoneOverride(true);
        expect(state.devPhoneOverride).toBe(true);
        state.setDevPhoneOverride(null);
        expect(state.devPhoneOverride).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createMobileUiSlice.test.ts`
Expected: FAIL — "Failed to resolve import ... createMobileUiSlice".

- [ ] **Step 3: Add the types to `src/store/types.ts`**

Add near the other slice interfaces (the file already has `ViewportSlice` around line 443):

```ts
export type MobileTab = 'calendar' | 'exams' | 'subjects' | 'map' | 'student';
export type MapSheetState = 'peek' | 'expanded';
export type MapSheetTab = 'akce' | 'knihovna' | 'budova';

/** Discriminated union of every sheet the phone UI can open. */
export type MobileSheet =
  | { kind: 'eventDetail'; eventId: string }
  | { kind: 'subjectDrawer'; courseCode: string; courseName?: string; courseId?: string }
  | { kind: 'studyPlan' }
  | { kind: 'profile' }
  | { kind: 'person'; personId: string }
  | { kind: 'eduroam' }
  | { kind: 'docs' }
  | { kind: 'erasmus' }
  | { kind: 'notifications' }
  | { kind: 'confirm'; confirmId: string };

export interface MobileUiSlice {
  mobileTab: MobileTab;
  mobileSelectedDayIso: string | null;
  mobileSheets: MobileSheet[];
  mapSheetState: MapSheetState;
  mapTab: MapSheetTab;
  /** Dev-only forced phone/desktop branch. null = defer to viewport. */
  devPhoneOverride: boolean | null;

  setMobileTab: (tab: MobileTab) => void;
  setMobileSelectedDay: (iso: string | null) => void;
  pushSheet: (sheet: MobileSheet) => void;
  popSheet: () => void;
  replaceSheet: (sheet: MobileSheet) => void;
  closeAllSheets: () => void;
  setMapSheetState: (state: MapSheetState) => void;
  setMapTab: (tab: MapSheetTab) => void;
  setDevPhoneOverride: (value: boolean | null) => void;
}
```

Then add `MobileUiSlice &` to the `AppState` intersection (near `ViewportSlice &`, around line 562).

- [ ] **Step 4: Write the slice**

Create `src/store/slices/createMobileUiSlice.ts`:

```ts
import type { AppSlice, MobileUiSlice } from '../types';

/**
 * Navigational state for the phone UI: which tab, which day, and the sheet
 * stack. A stack rather than a flag because the prototype genuinely nests
 * (Student → person, Subjects → drawer → confirm), and it gives Android
 * back-button handling for free later.
 *
 * Purely-local disclosure state (which accordion is open) deliberately stays
 * in component useState — this slice is for state that crosses components.
 */
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set) => ({
    mobileTab: 'calendar',
    mobileSelectedDayIso: null,
    mobileSheets: [],
    mapSheetState: 'peek',
    mapTab: 'akce',
    devPhoneOverride: null,

    // Switching tabs closes sheets: a sheet belongs to the screen that opened it.
    setMobileTab: (tab) => set({ mobileTab: tab, mobileSheets: [] }),
    setMobileSelectedDay: (iso) => set({ mobileSelectedDayIso: iso }),

    pushSheet: (sheet) => set((s) => ({ mobileSheets: [...s.mobileSheets, sheet] })),
    popSheet: () => set((s) => ({ mobileSheets: s.mobileSheets.slice(0, -1) })),
    replaceSheet: (sheet) => set((s) => ({ mobileSheets: [...s.mobileSheets.slice(0, -1), sheet] })),
    closeAllSheets: () => set({ mobileSheets: [] }),

    setMapSheetState: (state) => set({ mapSheetState: state }),
    setMapTab: (tab) => set({ mapTab: tab }),
    setDevPhoneOverride: (value) => set({ devPhoneOverride: value }),
});
```

- [ ] **Step 5: Compose the slice into the store**

In `src/store/useAppStore.ts`, add the import alongside the others:

```ts
import { createMobileUiSlice } from './slices/createMobileUiSlice';
```

and add to the `create<AppState>()` object, next to `...createViewportSlice(...a),`:

```ts
  ...createMobileUiSlice(...a),
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/store/slices/__tests__/createMobileUiSlice.test.ts && npm run typecheck`
Expected: PASS, 10 tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/createMobileUiSlice.ts src/store/slices/__tests__/createMobileUiSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(mobile): add mobile UI slice with sheet stack"
```

---

### Task 4: Phone branch, dev override, and the E2E mount guard

Completes risk R1. After this task the phone branch exists, is reachable in dev, and any failure of touch emulation fails a test loudly instead of silently exercising the desktop tree.

**Files:**
- Create: `src/hooks/ui/usePhoneViewport.ts`
- Create: `src/components/mobile/MobileApp.tsx`
- Modify: `src/App.tsx`
- Modify: `dev/main.web.tsx`
- Modify: `playwright.config.ts`
- Test: `src/hooks/__tests__/usePhoneViewport.test.tsx`
- Test: `e2e/serenity/specs/mobile-shell.spec.ts`

**Interfaces:**
- Consumes: `resolvePhoneViewport` (Task 2); `MobileUiSlice.devPhoneOverride` and `setDevPhoneOverride` (Task 3).
- Produces: `usePhoneViewport(): boolean`; `<MobileApp />` (no props) rendering a container with `data-testid="mobile-app"`. Tasks 5–20 fill `MobileApp` in.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/__tests__/usePhoneViewport.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhoneViewport } from '../ui/usePhoneViewport';
import { useAppStore } from '../../store/useAppStore';

describe('usePhoneViewport', () => {
    beforeEach(() => {
        useAppStore.setState({ isTouch: false, isNarrow: false, devPhoneOverride: null });
    });

    it('is false on desktop', () => {
        const { result } = renderHook(() => usePhoneViewport());
        expect(result.current).toBe(false);
    });

    it('is true when touch and narrow', () => {
        useAppStore.setState({ isTouch: true, isNarrow: true });
        const { result } = renderHook(() => usePhoneViewport());
        expect(result.current).toBe(true);
    });

    it('honours the dev override', () => {
        useAppStore.setState({ devPhoneOverride: true });
        const { result } = renderHook(() => usePhoneViewport());
        expect(result.current).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/usePhoneViewport.test.tsx`
Expected: FAIL — "Failed to resolve import ... usePhoneViewport".

- [ ] **Step 3: Write the hook**

Create `src/hooks/ui/usePhoneViewport.ts`:

```ts
import { useAppStore } from '../../store/useAppStore';
import { resolvePhoneViewport } from '../../utils/resolvePhoneViewport';

/**
 * The one place the app asks "am I a phone". `isPhone` is derived, never
 * stored, so there is no second source of truth to drift from the viewport.
 */
export function usePhoneViewport(): boolean {
    const isTouch = useAppStore((s) => s.isTouch);
    const isNarrow = useAppStore((s) => s.isNarrow);
    const override = useAppStore((s) => s.devPhoneOverride);
    return resolvePhoneViewport({ isTouch, isNarrow, override });
}
```

- [ ] **Step 4: Write the minimal `MobileApp`**

Create `src/components/mobile/MobileApp.tsx`:

```tsx
import { Toaster } from '../ui/sonner';

/**
 * Root of the phone UI. Takes no props: `useAppLogic()` returns desktop-local
 * state (currentView, selectedSubject, currentDate) that the mobile UI slice
 * replaces, so there is nothing to thread through. It is still CALLED
 * unconditionally in App.tsx above the branch — that is what owns IDB
 * hydration and the REIS_READY handshake — we simply do not pass its result.
 *
 * Mounts its own Toaster: App.tsx's Toaster lives inside the desktop return,
 * so the phone branch would otherwise have no toast host and every
 * confirmation would silently do nothing.
 */
export function MobileApp() {
    return (
        <div
            data-testid="mobile-app"
            className="flex h-screen w-full flex-col overflow-hidden bg-base-200 text-base-content"
        >
            <Toaster position="top-center" />
        </div>
    );
}
```

- [ ] **Step 5: Add the branch to `src/App.tsx`**

Add the imports:

```tsx
import { MobileApp } from './components/mobile/MobileApp'
import { usePhoneViewport } from './hooks/ui/usePhoneViewport'
```

and insert the branch immediately after `const s = useAppLogic();` — before the `handlePrevWeek` definitions, so hooks run unconditionally:

```tsx
function App() {
  const s = useAppLogic();
  const isPhone = usePhoneViewport();

  const handlePrevWeek = () => { /* unchanged */ };
  const handleNextWeek = () => { /* unchanged */ };
  const handleToday = () => s.setCurrentDate(getSmartWeekRange().start);
  const getDateRangeLabel = () => { /* unchanged */ };

  if (isPhone) return <MobileApp />;

  return ( /* existing desktop tree, unchanged */ );
}
```

`s` stays bound because the desktop tree below uses it; the phone branch simply
does not consume it. Do **not** move the `useAppLogic()` call inside a
condition — hooks must run unconditionally.

- [ ] **Step 6: Wire the dev override in `dev/main.web.tsx`**

Add before the React root is created:

```ts
import { useAppStore } from '../src/store/useAppStore';

// Dev-only phone override: `?mobile=1` forces the phone branch, `?mobile=0`
// forces desktop. Guarded by import.meta.env.DEV so it cannot ship. Needed
// because `pointer: coarse` requires touch emulation, which plain browser
// resizing does not provide.
if (import.meta.env.DEV) {
    const param = new URLSearchParams(window.location.search).get('mobile');
    if (param === '1') useAppStore.getState().setDevPhoneOverride(true);
    if (param === '0') useAppStore.getState().setDevPhoneOverride(false);
}
```

- [ ] **Step 7: Add the `mobile-chromium` Playwright project**

In `playwright.config.ts`, add a third entry to `projects` (after `firefox-android`):

```ts
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
```

Chromium is used rather than Firefox because it supports both `isMobile` and `hasTouch`, which is what makes `pointer: coarse` resolve. The existing `firefox-android` project stays for the extension-on-Firefox path.

- [ ] **Step 8: Write the E2E mount guard**

Create `e2e/serenity/specs/mobile-shell.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

/**
 * Guard for spec risk R1. If touch emulation ever stops producing
 * `pointer: coarse`, every other mobile test would silently exercise the
 * DESKTOP tree and still pass. This fails loudly instead.
 */
test.describe('mobile shell', () => {
  test('phone branch mounts under touch emulation', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.getByTestId('mobile-app')).toBeVisible();
  });
});
```

- [ ] **Step 9: Run the checks**

Run: `npx vitest run src/hooks/__tests__/usePhoneViewport.test.tsx && npm run typecheck`
Expected: PASS, 3 tests; typecheck clean.

Then, with `npm run dev:web` running in another terminal:
Run: `npx playwright test e2e/serenity/specs/mobile-shell.spec.ts --project=mobile-chromium`
Expected: PASS, 1 test.

Sanity-check the override manually: open `http://localhost:3000/?mobile=1` in a normal desktop browser and confirm the phone container renders; `?mobile=0` on a phone-sized window renders the desktop tree.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/ui/usePhoneViewport.ts src/hooks/__tests__/usePhoneViewport.test.tsx src/components/mobile/MobileApp.tsx src/App.tsx dev/main.web.tsx playwright.config.ts e2e/serenity/specs/mobile-shell.spec.ts
git commit -m "feat(mobile): add phone branch, dev override and E2E mount guard"
```

---

### Task 5: DM Sans + the `Sheet` primitive

Fonts are folded in here because `SheetHeader` is the first component to render display type.

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Create: `src/components/mobile/primitives/Sheet.tsx`
- Create: `src/components/mobile/primitives/SheetHeader.tsx`
- Test: `src/components/mobile/primitives/__tests__/Sheet.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<Sheet size="full" | "content" onClose={() => void}>{children}</Sheet>` and `<SheetHeader title={string} subtitle?={string} onClose?={() => void} />`. Tasks 8–19 build every sheet on these. Tailwind gains a `font-display` family.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/primitives/__tests__/Sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
    it('renders its children', () => {
        render(<Sheet size="content" onClose={() => {}}>hello</Sheet>);
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('calls onClose when the backdrop is clicked', () => {
        const onClose = vi.fn();
        render(<Sheet size="content" onClose={onClose}>body</Sheet>);
        fireEvent.click(screen.getByTestId('sheet-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the panel itself is clicked', () => {
        const onClose = vi.fn();
        render(<Sheet size="content" onClose={onClose}>body</Sheet>);
        fireEvent.click(screen.getByTestId('sheet-panel'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('full size pins the panel below the status area; content size hugs the bottom', () => {
        const { rerender } = render(<Sheet size="full" onClose={() => {}}>x</Sheet>);
        expect(screen.getByTestId('sheet-panel').className).toContain('top-[70px]');
        rerender(<Sheet size="content" onClose={() => {}}>x</Sheet>);
        expect(screen.getByTestId('sheet-panel').className).not.toContain('top-[70px]');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/primitives/__tests__/Sheet.test.tsx`
Expected: FAIL — "Failed to resolve import ... Sheet".

- [ ] **Step 3: Load DM Sans and register the Tailwind family**

Append to `src/index.css` (after the `:root` custom properties block):

```css
/* DM Sans — display face for the phone UI. Files already ship in public/fonts. */
@font-face {
  font-family: 'DM Sans';
  src: url('/fonts/dm-sans-regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'DM Sans';
  src: url('/fonts/dm-sans-medium.woff2') format('woff2');
  font-weight: 500 600;
  font-display: swap;
}
@font-face {
  font-family: 'DM Sans';
  src: url('/fonts/dm-sans-bold.woff2') format('woff2');
  font-weight: 700 800;
  font-display: swap;
}
```

In `tailwind.config.js`, extend the existing `fontFamily` block (currently only `inter`):

```js
            fontFamily: {
                inter: ['Inter', 'sans-serif'],
                display: ['DM Sans', 'Inter', 'sans-serif'],
            },
```

- [ ] **Step 4: Write the primitives**

Create `src/components/mobile/primitives/Sheet.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface SheetProps {
    /** `full` pins below the status area and scrolls; `content` hugs the bottom. */
    size: 'full' | 'content';
    onClose: () => void;
    children: ReactNode;
    /** Raises the sheet above other sheets (confirm dialogs). */
    elevated?: boolean;
}

/**
 * The one bottom-sheet container. Nine sheets share this exact behaviour:
 * backdrop fade, slide-up, tap-outside-to-close, and one of two heights.
 */
export function Sheet({ size, onClose, children, elevated }: SheetProps) {
    const backdropZ = elevated ? 'z-60' : 'z-50';
    const panelZ = elevated ? 'z-61' : 'z-51';
    const panelPosition =
        size === 'full'
            ? 'top-[70px] bottom-0'
            : 'bottom-0 max-h-[85dvh]';

    return (
        <>
            <div
                data-testid="sheet-backdrop"
                onClick={onClose}
                className={`absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out] ${backdropZ}`}
            />
            <div
                data-testid="sheet-panel"
                className={`absolute inset-x-0 ${panelPosition} ${panelZ} flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer animate-[sheetUp_0.3s_ease-out]`}
            >
                {children}
            </div>
        </>
    );
}
```

Create `src/components/mobile/primitives/SheetHeader.tsx`:

```tsx
import { X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export interface SheetHeaderProps {
    title: string;
    subtitle?: string;
    eyebrow?: string;
    onClose?: () => void;
}

/** Drag handle + title block, shared by every sheet. */
export function SheetHeader({ title, subtitle, eyebrow, onClose }: SheetHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-shrink-0">
            <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-base-300" />
            <div className="flex items-start gap-3 px-4 pb-3 pt-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {eyebrow && (
                        <span className="font-mono text-2xs font-semibold tracking-wider text-primary">
                            {eyebrow}
                        </span>
                    )}
                    <span className="font-display text-lg font-bold tracking-tight">{title}</span>
                    {subtitle && <span className="text-xs text-content-muted">{subtitle}</span>}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        aria-label={t('mobile.sheet.close')}
                        className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
```

Add the two keyframes to `src/index.css` (Tailwind 4 has no built-in `sheetUp`):

```css
@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/components/mobile/primitives/__tests__/Sheet.test.tsx && npm run typecheck`
Expected: PASS, 4 tests; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/index.css tailwind.config.js src/components/mobile/primitives/
git commit -m "feat(mobile): add Sheet primitive and load DM Sans display face"
```

---

### Task 6: `BottomNav` + screen router

Delivers a navigable shell: five pills that switch between five placeholder screens. Prototype reference: lines 301–307 (nav), 36–37 (app container).

**Files:**
- Create: `src/components/mobile/nav/BottomNav.tsx`
- Create: `src/components/mobile/screens/CalendarScreen.tsx`
- Create: `src/components/mobile/screens/ExamsScreen.tsx`
- Create: `src/components/mobile/screens/SubjectsScreen.tsx`
- Create: `src/components/mobile/screens/MapScreen.tsx`
- Create: `src/components/mobile/screens/StudentScreen.tsx`
- Modify: `src/components/mobile/MobileApp.tsx`
- Test: `src/components/mobile/nav/__tests__/BottomNav.test.tsx`

**Interfaces:**
- Consumes: `MobileUiSlice.mobileTab` / `setMobileTab` (Task 3).
- Produces: five screen components, each `export function XScreen(): JSX.Element`, filled in by Tasks 8–16. `MobileApp` routes on `mobileTab`.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/nav/__tests__/BottomNav.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';
import { useAppStore } from '../../../../store/useAppStore';

describe('BottomNav', () => {
    beforeEach(() => {
        useAppStore.setState({ mobileTab: 'calendar', language: 'cz' });
    });

    it('renders five tabs', () => {
        render(<BottomNav />);
        expect(screen.getAllByRole('tab')).toHaveLength(5);
    });

    it('labels only the active tab', () => {
        render(<BottomNav />);
        expect(screen.getByText('Kalendář')).toBeInTheDocument();
        expect(screen.queryByText('Zkoušky')).not.toBeInTheDocument();
    });

    it('marks the active tab with aria-selected', () => {
        render(<BottomNav />);
        const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
        expect(selected).toHaveLength(1);
    });

    it('switches the tab on click', () => {
        render(<BottomNav />);
        fireEvent.click(screen.getByRole('tab', { name: 'Zkoušky' }));
        expect(useAppStore.getState().mobileTab).toBe('exams');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/nav/__tests__/BottomNav.test.tsx`
Expected: FAIL — "Failed to resolve import ... BottomNav".

- [ ] **Step 3: Write `BottomNav`**

Create `src/components/mobile/nav/BottomNav.tsx`:

```tsx
import { Calendar, CalendarCheck, Book, MapPin, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileTab } from '../../../store/types';

const TABS: { id: MobileTab; icon: typeof Calendar; labelKey: string }[] = [
    { id: 'calendar', icon: Calendar, labelKey: 'mobile.nav.calendar' },
    { id: 'exams', icon: CalendarCheck, labelKey: 'mobile.nav.exams' },
    { id: 'subjects', icon: Book, labelKey: 'mobile.nav.subjects' },
    { id: 'map', icon: MapPin, labelKey: 'mobile.nav.map' },
    { id: 'student', icon: User, labelKey: 'mobile.nav.student' },
];

/**
 * Floating pill bar. Only the active tab shows its label, which is what keeps
 * five entries comfortable down to 375px.
 */
export function BottomNav() {
    const activeTab = useAppStore((s) => s.mobileTab);
    const setMobileTab = useAppStore((s) => s.setMobileTab);
    const keyboardOpen = useAppStore((s) => s.keyboardOpen);
    const { t } = useTranslation();

    if (keyboardOpen) return null;

    return (
        <div
            role="tablist"
            className="absolute bottom-[18px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-base-300 bg-base-100 p-1.5 shadow-drawer"
        >
            {TABS.map(({ id, icon: Icon, labelKey }) => {
                const active = id === activeTab;
                return (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={active}
                        aria-label={t(labelKey)}
                        onClick={() => setMobileTab(id)}
                        className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors ${
                            active ? 'bg-primary/15 text-primary' : 'text-content-muted'
                        }`}
                    >
                        <Icon className="h-[19px] w-[19px]" />
                        {active && <span className="text-xs font-semibold">{t(labelKey)}</span>}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Create the five placeholder screens**

Each is a stub with the shape its later task fills in. Create all five; here is `CalendarScreen.tsx`, and the other four are identical apart from the name and testid:

```tsx
export function CalendarScreen() {
    return <div data-testid="calendar-screen" className="flex flex-1 flex-col overflow-hidden" />;
}
```

Create `ExamsScreen.tsx` (`exams-screen`), `SubjectsScreen.tsx` (`subjects-screen`), `MapScreen.tsx` (`map-screen`), `StudentScreen.tsx` (`student-screen`) the same way.

- [ ] **Step 5: Route in `MobileApp`**

Replace the body of `src/components/mobile/MobileApp.tsx`:

```tsx
import { Toaster } from '../ui/sonner';
import { useAppStore } from '../../store/useAppStore';
import { BottomNav } from './nav/BottomNav';
import { CalendarScreen } from './screens/CalendarScreen';
import { ExamsScreen } from './screens/ExamsScreen';
import { SubjectsScreen } from './screens/SubjectsScreen';
import { MapScreen } from './screens/MapScreen';
import { StudentScreen } from './screens/StudentScreen';

export function MobileApp() {
    const tab = useAppStore((s) => s.mobileTab);

    return (
        <div
            data-testid="mobile-app"
            className="relative flex h-screen w-full flex-col overflow-hidden bg-base-200 text-base-content"
        >
            <Toaster position="top-center" />
            {tab === 'calendar' && <CalendarScreen />}
            {tab === 'exams' && <ExamsScreen />}
            {tab === 'subjects' && <SubjectsScreen />}
            {tab === 'map' && <MapScreen />}
            {tab === 'student' && <StudentScreen />}
            <BottomNav />
        </div>
    );
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/components/mobile/ && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add bottom nav and screen router"
```

---

### Task 7: `nowNext` and `dayAgenda` pure functions

The two derivations behind the Kalendář screen. Both take an injected `now` so they are deterministic. Prototype reference: lines 45–51 (hero), 66–84 (agenda + gaps).

**Files:**
- Create: `src/test/fixtures/lesson.ts`
- Create: `src/utils/mobile/nowNext.ts`
- Create: `src/utils/mobile/dayAgenda.ts`
- Test: `src/utils/mobile/__tests__/nowNext.test.ts`
- Test: `src/utils/mobile/__tests__/dayAgenda.test.ts`

**Interfaces:**
- Consumes: `BlockLesson` from `src/types/calendarTypes.ts` (fields used: `id`, `date` as `YYYYMMDD`, `startTime`/`endTime` as `HH:MM`, `courseName`, `room`, `isExam`).
- Produces:
  - `resolveNowNext(lessons: BlockLesson[], now: Date): NowNext | null` where `NowNext = { current: BlockLesson; elapsedPct: number; minutesLeft: number; next: BlockLesson | null }`.
  - `buildDayAgenda(lessons: BlockLesson[], dayIso: string): AgendaRow[]` where `AgendaRow = { type: 'event'; lesson: BlockLesson } | { type: 'gap'; minutes: number }`.

- [ ] **Step 1: Create the shared lesson fixture**

Three test files need the same `BlockLesson` factory, so it lives in one place. Create `src/test/fixtures/lesson.ts`:

```ts
import type { BlockLesson } from '../../types/calendarTypes';

/**
 * A minimal valid BlockLesson for tests. Defaults to Monday 2026-04-20,
 * 09:00–10:50 in Q01; override whatever the test cares about.
 */
export function makeLesson(over: Partial<BlockLesson> = {}): BlockLesson {
    return {
        id: 'l1',
        date: '20260420',
        startTime: '09:00',
        endTime: '10:50',
        courseName: 'Management',
        courseCode: 'EBC-MAN',
        courseId: '1',
        room: 'Q01',
        roomStructured: {} as BlockLesson['roomStructured'],
        teachers: [],
        periodId: '',
        studyId: '',
        campus: '',
        isDefaultCampus: '',
        facultyCode: '',
        isSeminar: 'false',
        isConsultation: 'false',
        ...over,
    };
}
```

- [ ] **Step 2: Write the failing `nowNext` test**

Create `src/utils/mobile/__tests__/nowNext.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveNowNext } from '../nowNext';
import { makeLesson as lesson } from '../../../test/fixtures/lesson';

describe('resolveNowNext', () => {
  it('returns null when nothing is running', () => {
    const l = [lesson({ startTime: '14:00', endTime: '15:50' })];
    expect(resolveNowNext(l, new Date('2026-04-20T09:30:00'))).toBeNull();
  });

  it('finds the running lesson and its elapsed percentage', () => {
    const l = [lesson({ startTime: '09:00', endTime: '11:00' })];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.current.id).toBe('l1');
    expect(r?.elapsedPct).toBe(50);
    expect(r?.minutesLeft).toBe(60);
  });

  it('reports the next lesson of the same day', () => {
    const l = [
      lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
      lesson({ id: 'b', startTime: '11:00', endTime: '12:50', courseName: 'Mikroekonomie I' }),
    ];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.next?.id).toBe('b');
  });

  it('reports next as null when the running lesson is the last of the day', () => {
    const l = [lesson({ startTime: '09:00', endTime: '10:50' })];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.next).toBeNull();
  });

  it('ignores lessons on other days', () => {
    const l = [lesson({ date: '20260421', startTime: '09:00', endTime: '11:00' })];
    expect(resolveNowNext(l, new Date('2026-04-20T10:00:00'))).toBeNull();
  });

  it('clamps elapsed percentage into 0..100', () => {
    const l = [lesson({ startTime: '09:00', endTime: '11:00' })];
    const r = resolveNowNext(l, new Date('2026-04-20T09:00:00'));
    expect(r?.elapsedPct).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/mobile/__tests__/nowNext.test.ts`
Expected: FAIL — "Failed to resolve import ... nowNext".

- [ ] **Step 4: Write `nowNext.ts`**

Create `src/utils/mobile/nowNext.ts`:

```ts
import type { BlockLesson } from '../../types/calendarTypes';

export interface NowNext {
    current: BlockLesson;
    /** 0..100, how far through the lesson we are. */
    elapsedPct: number;
    minutesLeft: number;
    next: BlockLesson | null;
}

/** Local-midnight-relative minute offset of an "HH:MM" string. */
function minutesOfDay(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function compactDate(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The "Teď běží" hero's data. Returns null when nothing is running right now,
 * which is the common case and renders no card at all.
 */
export function resolveNowNext(lessons: BlockLesson[], now: Date): NowNext | null {
    const today = compactDate(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todays = lessons
        .filter((l) => l.date === today)
        .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

    const current = todays.find(
        (l) => minutesOfDay(l.startTime) <= nowMin && nowMin < minutesOfDay(l.endTime)
    );
    if (!current) return null;

    const start = minutesOfDay(current.startTime);
    const end = minutesOfDay(current.endTime);
    const span = Math.max(end - start, 1);
    const elapsedPct = Math.min(100, Math.max(0, Math.round(((nowMin - start) / span) * 100)));

    const next = todays.find((l) => minutesOfDay(l.startTime) >= end) ?? null;

    return { current, elapsedPct, minutesLeft: end - nowMin, next };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/mobile/__tests__/nowNext.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing `dayAgenda` test**

Create `src/utils/mobile/__tests__/dayAgenda.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDayAgenda } from '../dayAgenda';
import { makeLesson as lesson } from '../../../test/fixtures/lesson';

describe('buildDayAgenda', () => {
  it('returns an empty list for a day with no lessons', () => {
    expect(buildDayAgenda([], '2026-04-20')).toEqual([]);
  });

  it('returns lessons for the requested day in start order', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'b', startTime: '13:00', endTime: '14:50' }),
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.filter((r) => r.type === 'event').map((r) => (r as never)['lesson'].id)).toEqual(['a', 'b']);
  });

  it('inserts a gap row when the gap is 60 minutes or more', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
        lesson({ id: 'b', startTime: '13:00', endTime: '14:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'gap', 'event']);
    expect(rows[1]).toEqual({ type: 'gap', minutes: 130 });
  });

  it('does not insert a gap for short breaks', () => {
    const rows = buildDayAgenda(
      [
        lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
        lesson({ id: 'b', startTime: '11:00', endTime: '12:50' }),
      ],
      '2026-04-20'
    );
    expect(rows.map((r) => r.type)).toEqual(['event', 'event']);
  });

  it('excludes lessons on other days', () => {
    const rows = buildDayAgenda([lesson({ date: '20260421' })], '2026-04-20');
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/utils/mobile/__tests__/dayAgenda.test.ts`
Expected: FAIL — "Failed to resolve import ... dayAgenda".

- [ ] **Step 8: Write `dayAgenda.ts`**

Create `src/utils/mobile/dayAgenda.ts`:

```ts
import type { BlockLesson } from '../../types/calendarTypes';

export type AgendaRow =
    | { type: 'event'; lesson: BlockLesson }
    | { type: 'gap'; minutes: number };

/** A break shorter than this reads as a normal changeover, not free time. */
const GAP_THRESHOLD_MINUTES = 60;

function minutesOfDay(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/** "2026-04-20" → "20260420" */
function compactFromIso(iso: string): string {
    return iso.replace(/-/g, '');
}

/**
 * The day list: lessons in start order, with "2 h volno" markers between
 * blocks that are far enough apart to be worth walking home for.
 */
export function buildDayAgenda(lessons: BlockLesson[], dayIso: string): AgendaRow[] {
    const target = compactFromIso(dayIso);
    const days = lessons
        .filter((l) => l.date === target)
        .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

    const rows: AgendaRow[] = [];
    days.forEach((lesson, i) => {
        if (i > 0) {
            const gap = minutesOfDay(lesson.startTime) - minutesOfDay(days[i - 1]!.endTime);
            if (gap >= GAP_THRESHOLD_MINUTES) rows.push({ type: 'gap', minutes: gap });
        }
        rows.push({ type: 'event', lesson });
    });
    return rows;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/utils/mobile/`
Expected: PASS, 11 tests.

- [ ] **Step 10: Commit**

```bash
git add src/utils/mobile/
git commit -m "feat(mobile): add nowNext and dayAgenda derivations"
```

---

### Task 8: `CalendarScreen`

Prototype reference: lines 39–87. Consumes Task 7's derivations.

**Files:**
- Modify: `src/components/mobile/screens/CalendarScreen.tsx`
- Create: `src/components/mobile/screens/calendar/NowNextCard.tsx`
- Create: `src/components/mobile/screens/calendar/DayChips.tsx`
- Create: `src/components/mobile/screens/calendar/DayAgenda.tsx`
- Create: `src/components/mobile/screens/calendar/AgendaEvent.tsx`
- Create: `src/components/mobile/screens/calendar/ScreenHeader.tsx`
- Create: `src/components/mobile/screens/calendar/GapMarker.tsx`
- Test: `src/components/mobile/screens/__tests__/CalendarScreen.test.tsx`

**Interfaces:**
- Consumes: `resolveNowNext`, `buildDayAgenda` (Task 7); `useSchedule()` → `{ schedule: BlockLesson[]; isLoaded; status; isSyncing; weekStart }`; `useNotificationFeed()`, `useDeadlineAlerts()`; `pushSheet` (Task 3); `Sheet`/`SheetHeader` (Task 5).
- Produces: `<ScreenHeader eyebrow title action?/>`, reused by Tasks 11, 12 and 16.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/screens/__tests__/CalendarScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';

describe('CalendarScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      syncStatus: { isSyncing: false, lastSync: 1, error: null, handshakeDone: true, handshakeTimedOut: false },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the empty state when the day has no lessons', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('renders the now-running hero while a lesson is in progress', () => {
    useAppStore.setState({ schedule: { data: [lesson({})], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(screen.getByText('Teď běží')).toBeInTheDocument();
    expect(screen.getByText(/Management/)).toBeInTheDocument();
  });

  it('renders a gap marker between distant lessons', () => {
    useAppStore.setState({
      schedule: {
        data: [lesson({ id: 'a' }), lesson({ id: 'b', startTime: '13:00', endTime: '14:50' })],
        status: 'success', weekStart: null,
      } as never,
    });
    render(<CalendarScreen />);
    expect(screen.getByTestId('agenda-gap')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/screens/__tests__/CalendarScreen.test.tsx`
Expected: FAIL — the empty-state text is not found (the screen is still the Task 6 stub).

- [ ] **Step 3: Write `ScreenHeader`**

Create `src/components/mobile/screens/calendar/ScreenHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface ScreenHeaderProps {
    eyebrow: string;
    title: string;
    action?: ReactNode;
}

/** The shared screen title block: small eyebrow above a display-face title. */
export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
    return (
        <div className="flex flex-shrink-0 items-end justify-between px-5 pb-1 pt-5">
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-content-muted">{eyebrow}</span>
                <span className="font-display text-2xl font-extrabold tracking-tight">{title}</span>
            </div>
            {action}
        </div>
    );
}
```

- [ ] **Step 4: Write the calendar pieces**

`NowNextCard.tsx` — renders the hero from a `NowNext`, per prototype lines 46–51:

```tsx
import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useTranslation } from '../../../../hooks/useTranslation';

export function NowNextCard({ data, onRoute }: { data: NowNext; onRoute: () => void }) {
    const { t } = useTranslation();
    const { current, next, elapsedPct, minutesLeft } = data;
    const teacher = current.teachers[0]?.name ?? '';

    return (
        <div className="mx-4 mt-3.5 flex flex-shrink-0 flex-col gap-2.5 rounded-2xl border border-primary/25 bg-base-100 p-4">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {t('mobile.calendar.nowRunning')}
                </span>
                <span className="text-xs font-semibold text-content-muted">
                    {t('mobile.calendar.endsIn', { minutes: minutesLeft })}
                </span>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="font-display text-lg font-bold tracking-tight">{current.courseName}</span>
                <span className="text-xs text-content-secondary">
                    {current.room} · {current.startTime} – {current.endTime}
                    {teacher && ` · ${teacher}`}
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-base-300">
                <div className="h-full rounded-full bg-primary" style={{ width: `${elapsedPct}%` }} />
            </div>
            {next && (
                <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-medium text-content-muted">
                        {t('mobile.calendar.next', { title: `${next.courseName} · ${next.room} · ${next.startTime}` })}
                    </span>
                    <button onClick={onRoute} className="py-1.5 pl-3 text-xs font-semibold text-primary">
                        {t('mobile.calendar.route')}
                    </button>
                </div>
            )}
        </div>
    );
}
```

`DayChips.tsx` — five day chips driven by `mobileSelectedDayIso`; `AgendaEvent.tsx` — one event card coloured by `isExam` / `isSeminar` per prototype lines 74–79; `DayAgenda.tsx` — maps `AgendaRow[]`, rendering `AgendaEvent` for `event` rows and, for `gap` rows, a divider carrying `data-testid="agenda-gap"` and the `mobile.calendar.gap` string.

- [ ] **Step 5: Assemble `CalendarScreen`**

`CalendarScreen.tsx` reads `useSchedule()`, defaults `mobileSelectedDayIso` to today when null, computes `resolveNowNext(schedule, new Date())` and `buildDayAgenda(schedule, selectedDay)`, and renders: `ScreenHeader` (with avatar and notification bell actions), `NowNextCard` when non-null, deadline-alert cards from `useDeadlineAlerts()`, the `MobileBulletinOverlay` trigger, `DayChips`, then either the empty state or `DayAgenda`. It renders a skeleton while `!handshakeDone && !handshakeTimedOut`.

Handlers:

| Affordance | Action |
|---|---|
| Event tap | `pushSheet({ kind: 'eventDetail', eventId })` |
| Bell | `pushSheet({ kind: 'notifications' })` |
| Avatar | `pushSheet({ kind: 'profile' })` |
| `NowNextCard` `onRoute` | `setMobileTab('map')` then select the next lesson's room — the same deep-link mechanism `PersonSheet` uses for "Ukázat kancelář na mapě" (Task 18). Not navigation. |

Bulletin reuses the existing `src/components/Bulletin/MobileBulletinOverlay.tsx` unchanged — it is already a phone-shaped overlay, so it is wired here rather than rebuilt.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/components/mobile/ && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 7: Verify visually**

With `npm run dev:web` running, open `http://localhost:3000/?mobile=1`, screenshot the Kalendář screen and compare against prototype lines 39–87.

- [ ] **Step 8: Commit**

```bash
git add src/components/mobile/screens/
git commit -m "feat(mobile): add Kalendar screen with now-running hero and day agenda"
```

---

### Task 9: Extract `useWatchdog` from `TermBuiltinActions`

A pure behavioural move so desktop and mobile share one implementation of IS's "hlídací pes" cycle. Desktop must behave identically afterwards.

**Files:**
- Create: `src/hooks/data/useWatchdog.ts`
- Modify: `src/components/ExamPanel/TermBuiltinActions.tsx`
- Test: `src/hooks/__tests__/useWatchdog.test.tsx`

**Interfaces:**
- Consumes: `triggerWatchdog(watchdogUrl: string): Promise<ExamActionResult>` from `src/api/exams.ts`; `ExamTerm.watchdogUrl` (present only when watchable; contains `aktivace=1` when off, `aktivace=2` when armed).
- Produces: `useWatchdog(term: ExamTerm)` → `{ armed: boolean; firing: boolean; feedback: 'activated' | 'deactivated' | 'failed' | null; errorMessage: string | null; toggle: () => Promise<void> }`. Task 11's `TermRow` uses it.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useWatchdog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWatchdog } from '../data/useWatchdog';
import type { ExamTerm } from '../../types/exams';

vi.mock('../../api/exams', () => ({
    triggerWatchdog: vi.fn(async () => ({ success: true })),
}));
const { triggerWatchdog } = await import('../../api/exams');

const term = (url?: string): ExamTerm => ({ id: 't1', date: '01.06.2026', time: '09:00', watchdogUrl: url });

describe('useWatchdog', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reads armed=false from an aktivace=1 URL', () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        expect(result.current.armed).toBe(false);
    });

    it('reads armed=true from an aktivace=2 URL', () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=2')));
        expect(result.current.armed).toBe(true);
    });

    it('flips optimistically and calls triggerWatchdog', async () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        await act(async () => { await result.current.toggle(); });
        expect(triggerWatchdog).toHaveBeenCalledWith('https://is/x?aktivace=1');
        await waitFor(() => expect(result.current.armed).toBe(true));
        expect(result.current.feedback).toBe('activated');
    });

    it('rolls the optimistic flip back when the request fails', async () => {
        vi.mocked(triggerWatchdog).mockResolvedValueOnce({ success: false, error: 'nope' });
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        await act(async () => { await result.current.toggle(); });
        await waitFor(() => expect(result.current.armed).toBe(false));
        expect(result.current.feedback).toBe('failed');
        expect(result.current.errorMessage).toBe('nope');
    });

    it('does nothing when the term has no watchdog URL', async () => {
        const { result } = renderHook(() => useWatchdog(term(undefined)));
        await act(async () => { await result.current.toggle(); });
        expect(triggerWatchdog).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useWatchdog.test.tsx`
Expected: FAIL — "Failed to resolve import ... useWatchdog".

- [ ] **Step 3: Write the hook**

Create `src/hooks/data/useWatchdog.ts`, moving the logic verbatim from `TermBuiltinActions.tsx` lines 19–66 — optimistic override, the effect that drops the override once the re-parsed URL agrees, the 3s feedback timer, and `triggerExamsRefresh()` on success. Signature exactly as in **Interfaces** above.

- [ ] **Step 4: Rewrite `TermBuiltinActions` to consume it**

Delete the local `useState`/`useEffect` block from `src/components/ExamPanel/TermBuiltinActions.tsx` and replace it with `const { armed, firing, feedback, errorMessage, toggle } = useWatchdog(term);`. **The rendered markup must not change** — this is a pure move.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run && npm run typecheck`
Expected: PASS — including every existing `ExamPanel` test, unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/data/useWatchdog.ts src/hooks/__tests__/useWatchdog.test.tsx src/components/ExamPanel/TermBuiltinActions.tsx
git commit -m "refactor(exams): extract useWatchdog so mobile and desktop share one implementation"
```

---

### Task 10: `examTimeline` pure function

Prototype reference: lines 98–106.

**Files:**
- Create: `src/utils/mobile/examTimeline.ts`
- Test: `src/utils/mobile/__tests__/examTimeline.test.ts`

**Interfaces:**
- Consumes: `ExamSubject` / `ExamSection` from `src/types/exams.ts`. Registered terms live at `section.registeredTerm` with `date` as `"DD.MM.YYYY"` and `time` as `"HH:MM"`.
- Produces: `buildExamTimeline(exams: ExamSubject[], now: Date): TimelinePoint[]` where `TimelinePoint = { id: string; subjectCode: string; date: Date; daysLeft: number; label: string }`, sorted ascending by date.

- [ ] **Step 1: Write the failing test**

Create `src/utils/mobile/__tests__/examTimeline.test.ts` covering: empty input → `[]`; sections without `registeredTerm` are skipped; a registered term yields one point with the right `daysLeft`; multiple points sort ascending; `daysLeft` is `0` for a term today; malformed dates are skipped rather than throwing.

```ts
import { describe, it, expect } from 'vitest';
import { buildExamTimeline } from '../examTimeline';
import type { ExamSubject } from '../../../types/exams';

const subject = (code: string, registered?: { id?: string; date: string; time: string }): ExamSubject => ({
  version: 1, id: code, name: code, code,
  sections: [{ id: `${code}-s`, name: 'zkouška', type: 'exam', status: registered ? 'registered' : 'open', registeredTerm: registered, terms: [] }],
});

describe('buildExamTimeline', () => {
  const now = new Date('2026-04-20T08:00:00');

  it('returns nothing for no exams', () => {
    expect(buildExamTimeline([], now)).toEqual([]);
  });

  it('skips sections with no registered term', () => {
    expect(buildExamTimeline([subject('EBC-ALG')], now)).toEqual([]);
  });

  it('builds a point with days remaining', () => {
    const pts = buildExamTimeline([subject('EBC-ALG', { id: 't1', date: '25.04.2026', time: '09:00' })], now);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.subjectCode).toBe('EBC-ALG');
    expect(pts[0]!.daysLeft).toBe(5);
  });

  it('reports zero days left for a term today', () => {
    const pts = buildExamTimeline([subject('EBC-ALG', { id: 't1', date: '20.04.2026', time: '14:00' })], now);
    expect(pts[0]!.daysLeft).toBe(0);
  });

  it('sorts points ascending by date', () => {
    const pts = buildExamTimeline(
      [
        subject('LATE', { id: 'a', date: '30.04.2026', time: '09:00' }),
        subject('EARLY', { id: 'b', date: '22.04.2026', time: '09:00' }),
      ],
      now
    );
    expect(pts.map((p) => p.subjectCode)).toEqual(['EARLY', 'LATE']);
  });

  it('skips malformed dates instead of throwing', () => {
    expect(buildExamTimeline([subject('BAD', { id: 'x', date: 'not-a-date', time: '09:00' })], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/mobile/__tests__/examTimeline.test.ts`
Expected: FAIL — "Failed to resolve import ... examTimeline".

- [ ] **Step 3: Write `examTimeline.ts`**

Create `src/utils/mobile/examTimeline.ts`:

```ts
import type { ExamSubject } from '../../types/exams';

export interface TimelinePoint {
    id: string;
    subjectCode: string;
    date: Date;
    daysLeft: number;
    label: string;
}

/** "DD.MM.YYYY" + "HH:MM" → Date, or null when the string is not that shape. */
function parseCzechDateTime(date: string, time: string): Date | null {
    const m = date.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (!m) return null;
    const [h, min] = (time.match(/^(\d{1,2}):(\d{2})$/) ? time.split(':') : ['0', '0']).map(Number);
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), h, min);
    return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(from: Date, to: Date): number {
    const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.round((b - a) / 86_400_000);
}

/**
 * Dots for the exam screen's timeline — one per registered term, nearest first.
 * Terms with unparseable dates are dropped rather than throwing: IS occasionally
 * emits placeholder text where a date should be.
 */
export function buildExamTimeline(exams: ExamSubject[], now: Date): TimelinePoint[] {
    const points: TimelinePoint[] = [];
    for (const exam of exams) {
        for (const section of exam.sections) {
            const reg = section.registeredTerm;
            if (!reg) continue;
            const date = parseCzechDateTime(reg.date, reg.time);
            if (!date) continue;
            points.push({
                id: reg.id ?? `${exam.code}-${reg.date}-${reg.time}`,
                subjectCode: exam.code,
                date,
                daysLeft: daysBetween(now, date),
                label: `${reg.date} ${reg.time}`,
            });
        }
    }
    return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/mobile/__tests__/examTimeline.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mobile/examTimeline.ts src/utils/mobile/__tests__/examTimeline.test.ts
git commit -m "feat(mobile): add examTimeline derivation"
```

---

### Task 11: `ExamsScreen`

Prototype reference: lines 89–159. Includes the working watch button and the classmate roster.

**Files:**
- Modify: `src/components/mobile/screens/ExamsScreen.tsx`
- Create: `src/components/mobile/screens/exams/ExamTimeline.tsx`
- Create: `src/components/mobile/screens/exams/ExamGroup.tsx`
- Create: `src/components/mobile/screens/exams/ExamCard.tsx`
- Create: `src/components/mobile/screens/exams/TermRow.tsx`
- Create: `src/components/mobile/sheets/ConfirmSheet.tsx`
- Test: `src/components/mobile/screens/__tests__/ExamsScreen.test.tsx`

**Interfaces:**
- Consumes: `useExams()` → `{ exams, isLoaded, error, retry }`; `useExamClassmates(terminId)` → `{ classmates, isLoaded, error }`; `useWatchdog(term)` (Task 9); `buildExamTimeline` (Task 10); `Sheet`/`SheetHeader` (Task 5); `pushSheet`/`popSheet` (Task 3); `ScreenHeader` (Task 8).
- Produces: `<ConfirmSheet />`, reused wherever a destructive or committing action needs confirmation.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/screens/__tests__/ExamsScreen.test.tsx` asserting: the empty state renders with no exams; a subject with terms renders a collapsed card; expanding shows `Přihlásit` on a registerable term; a term with `full: true` shows `obsazeno` and no register button; a term carrying `watchdogUrl` renders the watch button; a registered section shows `Odhlásit`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/screens/__tests__/ExamsScreen.test.tsx`
Expected: FAIL — the empty-state text is not found.

- [ ] **Step 3: Write `TermRow`**

One term row: label (`date` + `time`), sub-line (`room`, `teacher`, `sectionForm`), and exactly one trailing control — `Přihlásit` when `term.canRegisterNow`, `tvůj termín` when it is the registered term, `obsazeno` when `term.full || (capacity.occupied >= capacity.total)`. Independently of that, when `term.watchdogUrl` is present it renders the watch button wired to `useWatchdog(term)`, showing `Bell` / `BellRing` and the armed styling.

- [ ] **Step 4: Write `ExamCard`, `ExamGroup`, `ExamTimeline`, `ConfirmSheet`**

`ExamCard` holds local `expanded` state (`useState` — purely local disclosure), shows the subject name, section name and status, and renders `TermRow`s when expanded; a registered card additionally shows the classmate line from `useExamClassmates(registeredTerm.id)` and an `Odhlásit` button. `ExamGroup` is a collapsible section with a title and count. `ExamTimeline` maps `TimelinePoint[]` to dots positioned by index. `ConfirmSheet` renders title, subtitle, a detail box and primary/cancel buttons inside a `content`-size `Sheet` with `elevated`.

- [ ] **Step 5: Assemble `ExamsScreen`**

Reads `useExams()`, groups sections into upcoming vs other, renders `ScreenHeader` + `ExamTimeline` + `ExamGroup`s, skeleton while the handshake is unresolved, empty state when `exams.length === 0`. Register and unregister both `pushSheet({ kind: 'confirm', confirmId })`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/components/mobile/ && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 7: Verify visually**

`http://localhost:3000/?mobile=1`, Zkoušky tab, compared against prototype lines 89–159.

- [ ] **Step 8: Commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add Zkousky screen with watchdog and classmate roster"
```

---

### Task 12: `SubjectsScreen`

Prototype reference: lines 161–231.

**Files:**
- Modify: `src/components/mobile/screens/SubjectsScreen.tsx`
- Create: `src/components/mobile/screens/subjects/CreditRing.tsx`
- Create: `src/components/mobile/screens/subjects/SemesterCard.tsx`
- Create: `src/components/mobile/screens/subjects/AverageAccordion.tsx`
- Test: `src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx`

**Interfaces:**
- Consumes: `useStudyPlan()` → `StudyPlan | null`; `useSubjects()`; `useCourseGrade()`; `fetchStudyStats(studium, obdobi)` → `StudyStats` (field `weightedGpaTotal`); `parseStudyComparison`/`percentileStanding` from `src/api/studyComparison.ts` → `{ tier: 'top' | 'bottom'; pct }` plus `rank` and `total`; `ScreenHeader` (Task 8); `pushSheet` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx` asserting: the empty state renders with no study plan; the credit ring shows `96 / 180 kreditů` for a seeded plan; the average accordion is collapsed by default and reveals the three averages when tapped; the `top` percentile tier renders `mobile.subjects.topTier` while the `bottom` tier renders `mobile.subjects.beats`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/screens/__tests__/SubjectsScreen.test.tsx`
Expected: FAIL — empty-state text not found.

- [ ] **Step 3: Write `CreditRing`**

A `conic-gradient` ring sized from `earned / total`, with the percentage centred and the credit line beside it, per prototype lines 168–174. The gradient percentage is the one place an inline `style` is legitimate, because the value is data-driven.

- [ ] **Step 4: Write `SemesterCard` and `AverageAccordion`**

`SemesterCard` lists the current semester's subjects with grade chips and credit counts; a row calls `pushSheet({ kind: 'subjectDrawer', courseCode })`. `AverageAccordion` holds local `open` state and renders the three averages, the standing line and the rank, per prototype lines 195–228.

- [ ] **Step 5: Assemble `SubjectsScreen`**

`ScreenHeader` with a `Studijní plán` action that calls `pushSheet({ kind: 'studyPlan' })`, then `CreditRing`, `SemesterCard`, `AverageAccordion`. Skeleton while the handshake is unresolved.

- [ ] **Step 6: Run tests, typecheck, verify visually, commit**

Run: `npx vitest run src/components/mobile/ && npm run typecheck`, then screenshot the Předměty tab against prototype lines 161–231.

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add Predmety screen with credit ring and average accordion"
```

---

### Task 13: Characterization test + `SubjectFileDrawerContent` extraction

Mitigates spec risk R3. `SubjectFileDrawer/__tests__/` currently covers only `PdfDrawerLayout`, `pdfWindow` and `useNoteImage` — the content component itself is untested, so the safety net has to be built before the extraction.

**Files:**
- Test: `src/components/SubjectFileDrawer/__tests__/SubjectFileDrawerContent.test.tsx`
- Create: `src/components/SubjectFileDrawer/DrawerTabBody.tsx`
- Modify: `src/components/SubjectFileDrawer/SubjectFileDrawerContent.tsx`

**Interfaces:**
- Consumes: the existing drawer tab components.
- Produces: `<DrawerTabBody tab={DrawerTab} …/>` rendering the correct tab body with no surrounding chrome, so Task 14's mobile sheet can host it.

- [ ] **Step 1: Write the characterization test**

Pin *current desktop behaviour* before changing anything: each tab renders its expected body, switching tabs swaps the body, and badge counts appear on the tabs that carry them. This test must pass **before** any refactoring.

- [ ] **Step 2: Run it against the unmodified component**

Run: `npx vitest run src/components/SubjectFileDrawer/__tests__/SubjectFileDrawerContent.test.tsx`
Expected: PASS. If it fails, the test is wrong — fix the test, not the component.

- [ ] **Step 3: Commit the safety net on its own**

```bash
git add src/components/SubjectFileDrawer/__tests__/SubjectFileDrawerContent.test.tsx
git commit -m "test(drawer): characterize SubjectFileDrawerContent before extraction"
```

- [ ] **Step 4: Extract `DrawerTabBody`**

Move the tab-body switch out of `SubjectFileDrawerContent` into `DrawerTabBody.tsx`, leaving the desktop component to render its own chrome plus `<DrawerTabBody />`. **Pure move — no behaviour change.**

- [ ] **Step 5: Re-run the characterization test and the full suite**

Run: `npm run test:run && npm run typecheck`
Expected: PASS, with the characterization test unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/SubjectFileDrawer/
git commit -m "refactor(drawer): extract DrawerTabBody for reuse by the mobile sheet"
```

---

### Task 14: `SubjectDrawerSheet`

Prototype reference: lines 322–461. Five icon tabs with badges over the shared tab bodies.

**Files:**
- Create: `src/components/mobile/sheets/SubjectDrawerSheet.tsx`
- Create: `src/components/mobile/sheets/SheetHost.tsx`
- Modify: `src/components/mobile/MobileApp.tsx`
- Test: `src/components/mobile/sheets/__tests__/SheetHost.test.tsx`

**Interfaces:**
- Consumes: `DrawerTabBody` (Task 13); `useFiles`, `useClassmates`, `useSuccessRate`, `useSyllabus`, `useZaznamnik`, `useCvicneTests`; `Sheet`/`SheetHeader` (Task 5); `mobileSheets`/`popSheet` (Task 3).
- Produces: `<SheetHost />`, which every later sheet registers with.

- [ ] **Step 1: Write the failing `SheetHost` test**

Assert: nothing renders for an empty stack; the top sheet of the stack renders; two stacked sheets both render with the later one above; backdrop click pops exactly one sheet.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/sheets/__tests__/SheetHost.test.tsx`
Expected: FAIL — "Failed to resolve import ... SheetHost".

- [ ] **Step 3: Write `SheetHost`**

Maps `mobileSheets` to components via a `kind` switch, each wrapped in `Sheet`, with `onClose={popSheet}`. Unknown kinds render nothing rather than throwing.

- [ ] **Step 4: Write `SubjectDrawerSheet`**

A `full`-size `Sheet` with `SheetHeader` (course code as eyebrow, name as title, teacher as subtitle), a five-tab icon bar with count badges, `DrawerTabBody` beneath, and the "Otevřít v IS MENDELU" footer link.

- [ ] **Step 5: Mount `SheetHost` in `MobileApp`**

Add `<SheetHost />` as the last child, after `<BottomNav />`.

- [ ] **Step 6: Run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add sheet host and subject drawer sheet"
```

---

### Task 15: `MapSidePanel` section extraction + `MapScreen`

Prototype reference: lines 233–299. `MapSidePanel.test.tsx` already exists, so the extraction is covered.

**Files:**
- Modify: `src/components/CampusMap/MapSidePanel.tsx`
- Create: `src/components/CampusMap/MapEventsSection.tsx`
- Create: `src/components/CampusMap/MapLibrarySection.tsx`
- Modify: `src/components/mobile/screens/MapScreen.tsx`
- Create: `src/components/mobile/screens/map/MapSheet.tsx`
- Create: `src/components/mobile/screens/map/FloorSwitcher.tsx`
- Test: `src/components/mobile/screens/__tests__/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `MapCanvas`, `FloorStack`, `LibraryRoomSection`, `LibrarySlotPicker`, `EventRow`, `EventRsvp`; `mapSheetState`/`setMapSheetState`/`mapTab`/`setMapTab` (Task 3).
- Produces: `<MapEventsSection />` and `<MapLibrarySection />`, imported by both the desktop side panel and the mobile sheet.

- [ ] **Step 1: Run the existing desktop test to establish the baseline**

Run: `npx vitest run src/components/CampusMap/__tests__/MapSidePanel.test.tsx`
Expected: PASS. Record the count.

- [ ] **Step 2: Extract the two sections**

Pure move out of `MapSidePanel.tsx`; the desktop panel then renders `<MapEventsSection />` and `<MapLibrarySection />`. No behaviour change.

- [ ] **Step 3: Re-run the desktop test**

Run: `npx vitest run src/components/CampusMap/__tests__/MapSidePanel.test.tsx`
Expected: PASS with the same count as Step 1.

- [ ] **Step 4: Commit the extraction on its own**

```bash
git add src/components/CampusMap/
git commit -m "refactor(map): extract events and library sections for reuse"
```

- [ ] **Step 5: Write the failing `MapScreen` test**

Assert: the map canvas mounts; the sheet renders in `peek` state by default; tapping the handle expands it; the Akce/Knihovna tabs switch `mapTab`; the Budova tab only appears when a building is selected.

- [ ] **Step 6: Write `MapSheet`, `FloorSwitcher` and `MapScreen`, then run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add Mapa screen with bottom sheet and floor switcher"
```

---

### Task 16: `StudentScreen`

Prototype reference: lines 463–533.

**Files:**
- Modify: `src/components/mobile/screens/StudentScreen.tsx`
- Create: `src/components/mobile/screens/student/StudentSearch.tsx`
- Create: `src/components/mobile/screens/student/ShortcutGrid.tsx`
- Create: `src/components/mobile/screens/student/PageGroupList.tsx`
- Test: `src/components/mobile/screens/__tests__/StudentScreen.test.tsx`

**Interfaces:**
- Consumes: `useSearch` and `SearchResultItem` from `src/components/SearchBar/`; `usePersonProfile`, `usePersonPhoto`; `pushSheet` (Task 3); `ScreenHeader` (Task 8).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Assert: the Stránky IS segment is active by default and renders the shortcut grid; switching to Lidé shows the teacher list; typing a query shows results; a query with no matches shows `mobile.student.noResults`; the ISKAM card is a link to `https://webiskam.mendelu.cz/` rather than a sheet trigger.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/mobile/screens/__tests__/StudentScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the three pieces and assemble the screen**

`ShortcutGrid` renders four cards — Eduroam, Dokumenty, Erasmus (each `pushSheet`) and ISKAM (an `<a href="https://webiskam.mendelu.cz/">`, because ISKAM is a separate host integration with its own store and its data only refreshes on that domain).

- [ ] **Step 4: Run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add Student hub screen"
```

---

### Task 17: `EventDetailSheet`, `StudyPlanSheet`, `NotificationsSheet`

**Files:**
- Create: `src/components/mobile/sheets/EventDetailSheet.tsx`
- Create: `src/components/mobile/sheets/StudyPlanSheet.tsx`
- Create: `src/components/mobile/sheets/NotificationsSheet.tsx`
- Modify: `src/components/mobile/sheets/SheetHost.tsx`
- Test: `src/components/mobile/sheets/__tests__/EventDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `useSchedule`, `useStudyPlan`, `useNotificationFeed`, `useDeadlineAlerts`; the existing `StudyPlanPage`; `useAppStore`'s hidden-items actions (`createHiddenItemsSlice`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing `EventDetailSheet` test**

Assert: the sheet shows the lesson title, room, time and teacher; the hide action adds the event to hidden items and pops the sheet; the "show on map" action switches `mobileTab` to `map`.

- [ ] **Step 2: Run it, watch it fail, write the three sheets, register them in `SheetHost`**

`StudyPlanSheet` hosts the existing `StudyPlanPage` inside a `full` `Sheet`. `NotificationsSheet` renders `useNotificationFeed()` plus `useDeadlineAlerts()`.

- [ ] **Step 3: Run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add event detail, study plan and notifications sheets"
```

---

### Task 18: `ProfileSheet` and `PersonSheet`

Prototype reference: lines 561–578 (person), 623–687 (profile).

**Files:**
- Create: `src/components/mobile/sheets/ProfileSheet.tsx`
- Create: `src/components/mobile/sheets/PersonSheet.tsx`
- Modify: `src/components/mobile/sheets/SheetHost.tsx`
- Test: `src/components/mobile/sheets/__tests__/ProfileSheet.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, the i18n slice's `setLanguage`, `useOutlookSync`, `useDriveBackup`, `useSpolkySettings`, the hidden-items slice, `usePersonProfile`, `usePersonPhoto`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing `ProfileSheet` test**

Assert: the theme toggle flips between `mendelu-dark` and `mendelu`; the language segment switches locale; the Outlook and Drive toggles call their hooks; a hidden event appears with a restore button that removes it from the hidden list.

- [ ] **Step 2: Run it, watch it fail, write both sheets, register them in `SheetHost`**

`PersonSheet`'s "Ukázat kancelář na mapě" sets `mobileTab` to `map` and closes the stack.

- [ ] **Step 3: Run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add profile and person sheets"
```

---

### Task 19: `EduroamSheet`, `DocsSheet`, `ErasmusSheet`

Prototype reference: lines 535–559.

**Files:**
- Create: `src/components/mobile/sheets/EduroamSheet.tsx`
- Create: `src/components/mobile/sheets/DocsSheet.tsx`
- Create: `src/components/mobile/sheets/ErasmusSheet.tsx`
- Modify: `src/components/mobile/sheets/SheetHost.tsx`
- Test: `src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx`

**Interfaces:**
- Consumes: `useEduroamSetup`, `studyDocuments`, `useErasmus`, and the existing `ErasmusPanel`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing `EduroamSheet` test**

Assert: the three numbered steps render; the copy button copies the credentials; the download button triggers the platform-appropriate profile.

- [ ] **Step 2: Run it, watch it fail, write the three sheets, register them in `SheetHost`**

`ErasmusSheet` hosts the existing `ErasmusPanel` inside a `full` `Sheet`. Per the spec this is not a phone-native redesign — the Learning Agreement tables will be cramped, and that is a known, accepted v1 limitation with its own follow-up spec.

- [ ] **Step 3: Run tests, typecheck, verify visually, commit**

```bash
git add src/components/mobile/
git commit -m "feat(mobile): add eduroam, documents and erasmus sheets"
```

---

### Task 20: E2E suite and old-path cleanup

The last commit on the branch. Only now do old and new stop coexisting.

**Files:**
- Modify: `e2e/serenity/specs/mobile-shell.spec.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/components/AppMain.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Extend the E2E suite**

Add to `mobile-shell.spec.ts`: tab switching reaches all five screens; tapping a subject row opens the drawer sheet; the drawer's five tabs switch; the backdrop closes the sheet; opening Eduroam from Student shows its sheet.

- [ ] **Step 2: Run the mobile E2E suite**

Run: `npx playwright test e2e/serenity/specs/mobile-shell.spec.ts --project=mobile-chromium`
Expected: PASS, all tests.

- [ ] **Step 3: Remove the old mobile path from the IS app**

- Delete the `<MobileBottomNav … />` element and its import from `src/App.tsx`.
- Delete the `iskam-dashboard` branches from `src/components/Sidebar.tsx` (lines 29, 36, 61).
- Remove the `touch:` variant classes from `src/components/AppHeader.tsx` and `src/components/AppMain.tsx`, which exist only to squeeze desktop layouts onto phones.

**Do NOT delete `src/components/MobileNav/`.** `src/entrypoints/iskam/IskamApp.tsx:5` imports `MobileBottomNav`, which transitively keeps `MobileNavSheet` and `MobileProfileSheet` alive. For the same reason `'iskam-dashboard'` stays in the `AppView` union (`MobileBottomNav.tsx:80` is typed against it), `IskamApp.tsx` keeps its `touch:` usage, and the `touch:` custom variant stays defined in `src/index.css`. Retiring all three belongs to the ISKAM follow-up spec.

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: PASS across the board, including every desktop test.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "feat(mobile): retire the old responsive path in the IS app"
git push -u origin claude/reis-mobile
gh pr create --title "reIS Mobile: phone-native UI" --body "Implements docs/superpowers/specs/2026-07-26-reis-mobile-design.md"
```

---

## Verification checklist

Before the PR is reviewable:

- [ ] `npm run test:run` — all green, desktop tests unchanged
- [ ] `npm run typecheck` — clean
- [ ] `npx eslint src/components/mobile src/utils/mobile src/hooks/ui --max-warnings=0` — clean
- [ ] `npx playwright test --project=mobile-chromium` — green
- [ ] `npx playwright test --project=desktop` — green, no regression
- [ ] Each of the five screens screenshotted at 390×844 against its prototype line range
- [ ] `?mobile=0` on a phone-sized viewport still renders the desktop tree
- [ ] `.claude/hooks/guard-parsers.py` never fired during implementation
