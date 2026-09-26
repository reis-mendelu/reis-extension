# Admin Student Impersonation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reIS admin view the app as a student of another programme, year and study group (e.g. PEF · B-F · 1st year · group 2). The study plan, subjects and weekly timetable are fetched live from IS through the admin's own session, and the admin's real data stays untouched.

**Architecture:**
- **Fetching.** New pure parsers and one orchestrator live in `src/api/impersonation/`. They fetch through `fetchWithAuth`, which already reaches IS from every host: the extension iframe via the content script's `REIS_FETCH` proxy, Capacitor natively, and the dev webapp directly.
- **Overlay.** A Zustand middleware (`overlayGuard`) drops writes to the protected keys (schedule, plan, subjects, exams, stats…) while an impersonation is active. The new impersonation slice is the only writer allowed through, via `overlayWrite()`. The real sync keeps writing IndexedDB underneath.
- **UI.** One shared picker body, rendered in a desktop `AdaptiveDrawer` and in a mobile sheet, plus a banner on both trees.

**Tech Stack:** React 19, Zustand (slices plus one middleware), TypeScript, Vitest + happy-dom + @testing-library/react, DaisyUI/Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-26-admin-student-impersonation-design.md`. Task 1 amends it with what this plan changes.

## Global Constraints

- **Gate:** the entry is visible only when `adminRole === 'reis_admin'`. `startImpersonation` refuses otherwise, and refuses in demo mode.
- **Data source:** live IS only. Nothing goes to Supabase, reis-data or any CDN, and no fixture carries a bulk timetable.
- **v1 coverage:**
  - Prezenční, winter-intake programmes whose short code starts with `B-` (typ_studia 1) or `N-` (typ_studia 4).
  - Faculties: PEF (fakulta 2), AF (14), FRRMS (23), LDF (38), ZF (60).
- **Year 1:** timetable by programme + year 1 + study group (`skupina`), in one dated-JSON request per language.
- **Year 2+:** timetable per plan subject (`predmet=<id>` from the intake plan leaf). Keep the lectures and seminars of the **first slot** (weekday + start time + room) of each lesson type.
- **Semester math:** intake = ZS of (current start year − (year − 1)). Target semester = 2·year − 1 in ZS and 2·year in LS. September–January is ZS.
- **Real data:** never written by the overlay. Exit re-reads it from IndexedDB.
- **Iron rules (CLAUDE.md):**
  - no `localStorage`
  - no `useEffect` data fetching (fetch from actions/handlers)
  - DaisyUI classes only, no custom CSS
  - ≤ 200 lines per file
  - direct imports, no barrels
  - test first
- **i18n:** strings live in `src/i18n/locales/{cs,en}.json`. Interpolation is single-brace: `{name}`.
- **Parser rule:** every parser is tested against a **real** IS fixture, trimmed and scrubbed. No parser is edited to pass lint.
- **Commits:** end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Local checks per task:** `npx vitest run <pattern>` and `npm run typecheck`. Leave repo-wide lint, format, `test:run` and builds to CI. Under load, add `--no-file-parallelism --maxWorkers=1`.

## File Structure

**Create:**

- `src/api/impersonation/`
  - `types.ts`: shared types (`RozvrhRef`, `ProgrammeOption`, `FacultyOptions`, `ImpersonationSelection`, `ImpersonationResult`, `ImpersonationErrorCode`, `ImpersonationError`)
  - `text.ts`: `txt()` and `parseDoc()` helpers
  - `intake.ts`: period, intake and semester math
  - `catalogPlan.ts`: parses the public plan leaf into semesters/groups/rows; `toStudyPlan`, `subjectsToAttend`
  - `catalogNav.ts`: plan catalogue navigation (period row → programme page → leaf URL)
  - `timetableForm.ts`: timetable app HTML (ranges, rozvrh rows, criteria form, year-1 group numbers)
  - `timetableQuery.ts`: POST body builder and response classifier
  - `pickSlots.ts`: first-slot selection for year 2+
  - `fetchImpersonation.ts`: orchestrator (`loadOptions`, `loadYear1Groups`, `fetchImpersonation`)
  - `__tests__/fixtures/`: trimmed, scrubbed real IS samples (Task 1)
  - `__tests__/*.test.ts`: one test file per module
- `src/store/overlay/overlayGuard.ts`: the middleware, `OVERLAY_KEYS` and `overlayWrite`
- `src/store/overlay/overlayState.ts`: `overlayState(result)`, `blankOverlayState()`
- `src/store/slices/impersonation/impersonationStorage.ts`: the IDB `meta.impersonation` read/write
- `src/store/slices/createImpersonationSlice.ts`: the slice
- `src/components/Impersonation/`
  - `ImpersonationPicker.tsx`: shared picker body
  - `ImpersonationDrawer.tsx`: desktop wrapper
  - `ImpersonationBanner.tsx`: shared banner, `row` or `floating` variant
- `src/components/mobile/sheets/ImpersonationSheet.tsx`: phone/iPad wrapper

**Modify:**

- `src/api/schedule.ts`: export `NO_RESULTS_MARKERS`, extract and export `mergeDualLanguageLessons`
- `src/store/useAppStore.ts`: wrap in `overlayGuard`, add the slice, restore after `loadAdminSession`
- `src/store/types.ts`: add `ImpersonationSlice` to `AppState`, add `{ kind: 'impersonation' }` to `MobileSheet`
- `src/store/slices/createAdminSlice.ts`: `adminLogout` stops impersonation
- `src/store/slices/createDemoSlice.ts`: add `'impersonation'` to `IS_DERIVED_META_KEYS`
- `src/components/AppOverlays.tsx`: mount `ImpersonationDrawer`
- `src/App.tsx`: mount `<ImpersonationBanner variant="floating" />` in the desktop tree
- `src/components/Sidebar/ProfilePopup.tsx`: entry button
- `src/components/mobile/screens/ProfileScreen.tsx`: entry `NavRow`
- `src/components/mobile/MobileApp.tsx`: `<ImpersonationBanner variant="row" />` plus safe-top/toast offset
- `src/components/mobile/sheets/SheetHost.tsx`: `case 'impersonation'`
- `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`: the `impersonation` block
- `docs/superpowers/specs/2026-09-26-admin-student-impersonation-design.md`: the amendments (Task 1)

The raw IS samples are at `/Users/Dominik.Holek/Documents/reis/.is-samples/2026-09-26/`, outside every repo (mode 700). They were fetched on 2026-09-26 from live IS: timetable 5769 (PEF prezenční ZS 2026/27), B-F programme 1889, intakes 829 and 801.

---

### Task 1: Fixtures from real IS samples + spec amendment

**Files:**
- The scrub script lives in the session scratchpad and never enters the repo.
- Create: `src/api/impersonation/__tests__/fixtures/` with:
  - `catalog-periods-pef.html`
  - `catalog-programme-bf-801.html`
  - `catalog-plan-bf-801.cz.html`
  - `catalog-plan-bf-801.en.html`
  - `rozvrh-index.html`
  - `rozvrh-range.html`
  - `rozvrh-criteria.html`
  - `rozvrh-list-bf-y1.html`
  - `rozvrh-bf-y1-g2.cz.json`
  - `rozvrh-bf-y1-g2.en.json`
  - `rozvrh-predmet-ft.cz.json`
  - `rozvrh-predmet-ft.en.json`
- Modify: `docs/superpowers/specs/2026-09-26-admin-student-impersonation-design.md`

- [ ] **Step 1: Write the scrub script to the scratchpad**

Write `<scratchpad>/make-fixtures.py`:

```python
"""Trim + scrub real IS samples into test fixtures. Throwaway; never committed."""
import json, re, html, pathlib
SRC = pathlib.Path('/Users/Dominik.Holek/Documents/reis/.is-samples/2026-09-26')
OUT = pathlib.Path('src/api/impersonation/__tests__/fixtures'); OUT.mkdir(parents=True, exist_ok=True)

def rows(s): return re.findall(r'(?s)<tr[^>]*>.*?</tr>', s)
def page(body): return f'<!DOCTYPE html>\n<html><body>\n{body}\n</body></html>\n'

# Public catalogue pages (guest session, no personal data): kept whole.
for src, dst in [('plany-pef-periods.html', 'catalog-periods-pef.html'),
                 ('plany-BF-801-programme.html', 'catalog-programme-bf-801.html'),
                 ('plan-BF-801-cz.html', 'catalog-plan-bf-801.cz.html'),
                 ('plan-BF-801-en.html', 'catalog-plan-bf-801.en.html')]:
    (OUT / dst).write_text((SRC / src).read_text())

# /auth/ pages: keep only the structure the parsers read; drop the logged-in chrome.
idx = (SRC / 'rozvrh-index.html').read_text()
links = sorted(set(re.findall(r'<a href="(rozvrhy_view\.pl\?konf=1;z=\d{8};k=\d{8};lang=cz)"', idx)))
(OUT / 'rozvrh-index.html').write_text(page('\n'.join(f'<a href="{h}">{h}</a>' for h in links)))

rng = (SRC / 'rozvrh-range-5769.html').read_text()
keep = [r for r in rows(rng) if 'zahlavi' in r or re.search(r'value="(5769|5770|5766)"', r)]
(OUT / 'rozvrh-range.html').write_text(page('<table>\n' + '\n'.join(keep) + '\n</table>'))

crit = (SRC / 'criteria-5769.html').read_text()
def select(name, keep_values):
    m = re.search(rf'(?s)<select name="{name}"[^>]*>.*?</select>', crit)
    opts = [o for o in re.findall(r'<option[^>]*>[^<]*</option>', m.group(0))
            if re.search(r'value="([^"]*)"', o).group(1) in keep_values]
    return f'<select name="{name}">' + ''.join(opts) + '</select>'
form = ''.join([select('program', {'0', '1889', '1888', '2686'}),
                select('rocnik', {'0', '1', '2', '3'}),
                select('skupina', {'0', '1', '2', '3'}),
                select('predmet', {'0', '164066', '164068', '164227'})])
(OUT / 'rozvrh-criteria.html').write_text(page(f'<form name="formular">{form}</form>'))

lst = (SRC / 'tt-BF-r1-s0-list.html').read_text()
trs = rows(lst)
head = next(r for r in trs if 'Místnost' in r and 'Den' in r)
body = [r for r in trs if re.search(r'<td[^>]*>(Po|Út|St|Čt|Pá)</td>', r)]
picked, seen = [], set()
for r in body:
    lab = re.findall(r'(?s)<td[^>]*>(.*?)</td>', r)[9]
    if lab not in seen: seen.add(lab); picked.append(r)
scrubbed = [re.sub(r'(?s)(<td[^>]*>)(<a[^>]*>)?[^<]*(</a>)?(</td>)(?=<td[^>]*>[^<]*</td><td[^>]*>[^<]*</td></tr>)',
                   r'\1Učitel\4', r) for r in picked]
(OUT / 'rozvrh-list-bf-y1.html').write_text(page('<table>\n' + head + '\n' + '\n'.join(scrubbed) + '\n</table>'))

def scrub_json(src, dst, first_days=None):
    d = json.loads((SRC / src).read_text())
    ls = d['blockLessons']
    if first_days: ls = [l for l in ls if l['date'] <= first_days]
    for l in ls:
        l['teachers'] = [{'fullName': f'Učitel {i+1}', 'id': str(90000 + i), 'shortName': f'U. {i+1}'}
                         for i, _ in enumerate(l['teachers'])]
    d['blockLessons'] = ls
    (OUT / dst).write_text(json.dumps(d, ensure_ascii=False))
scrub_json('tt-BF-r1-s2-sem-cz.json', 'rozvrh-bf-y1-g2.cz.json', first_days='20260927')
scrub_json('tt-BF-r1-s2-sem-en.json', 'rozvrh-bf-y1-g2.en.json', first_days='20260927')
scrub_json('tt-FT-dated-cz.json', 'rozvrh-predmet-ft.cz.json')
scrub_json('tt-FT-dated-en.json', 'rozvrh-predmet-ft.en.json')
print('ok')
```

- [ ] **Step 2: Run it, then check that no identity survived**

Run from the worktree root:

```bash
python3 <scratchpad>/make-fixtures.py
```

Expected output: `ok`.

Then run each of these separately. Each must print nothing. The first check searches for the name and student id visible in Dominik's own IS session:

```bash
grep -rniE "holek|149707|logout\.pl|Portál studenta|Zapsané termíny" src/api/impersonation/__tests__/fixtures
```

```bash
grep -rnE "Stachoň|Plecitá|Otavová|Říhová|Janová|Melicharová" src/api/impersonation/__tests__/fixtures
```

If a teacher name survives in `rozvrh-list-bf-y1.html` (the regex scrub is positional), open the file and replace every Vyučující cell by hand with `Učitel`.

- [ ] **Step 3: Checkpoint: Dominik reviews the fixture diff**

Show `git diff --stat` plus the full contents of `rozvrh-list-bf-y1.html` and `rozvrh-criteria.html`. Ask: "Fixtures OK to commit to the public repo?" **Wait for an explicit yes.** Do not commit before it.

- [ ] **Step 4: Amend the spec**

Append this section to the spec:

```markdown
## Amendments from implementation planning (2026-09-26)

- **No new action.** `fetchWithAuth` already reaches IS from the extension iframe (the content
  script's `REIS_FETCH` proxy carries the cookies), natively on Capacitor, and directly on the dev
  webapp. The impersonation fetch runs in the iframe/app like the syllabus fetch; nothing changes
  in `src/injector/` or `src/mobile/actionHandler.ts`. Because the proxy labels every response
  `text/html`, JSON is detected from the body, not the content-type.
- **One IDB key.** Selection and result live together in `meta.impersonation` (no new object store,
  so no IndexedDB version bump). `createDemoSlice` clears it with the other IS-derived meta keys.
- **Year 2+ slot key.** A per-subject dated query merges parallels that share a slot, so the key is
  weekday + start time + room; a biweekly parallel therefore shows weekly. Known v1 limitation.
- **Enrolled marks.** Target-semester subjects the timetable was built from are `isEnrolled: true`,
  so the plan reads like a real student's current semester.
- **Expired cache.** A cached impersonation from another period ends silently at boot and the picker
  shows "Zobrazení jako student skončilo s koncem semestru." the next time it opens.
- **Excluded programmes.** Kombinovaná rozvrhy and non-B-/N- programmes are filtered out of the
  picker rather than listed disabled; a scope note under the selects says what v1 covers.
- **Empty timetable.** A no-results answer applies the plan with no lessons; the calendar's own
  empty state is the note.
```

- [ ] **Step 5: Commit**

```bash
git add src/api/impersonation/__tests__/fixtures docs/superpowers/specs/2026-09-26-admin-student-impersonation-design.md
git commit -m "test(impersonation): real IS fixtures (trimmed, scrubbed) + spec amendments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types, text helpers, intake math

**Files:**
- Create: `src/api/impersonation/types.ts`, `src/api/impersonation/text.ts`, `src/api/impersonation/intake.ts`
- Test: `src/api/impersonation/__tests__/intake.test.ts`

**Interfaces (produces):**
- `types.ts`:
  - `RozvrhRef { id; z; k; label; period; faculty; form; start; end }`. All strings; `start`/`end` are `DD.MM.YYYY`.
  - `ProgrammeOption { programId; shortCode; name; faculty; rozvrh: RozvrhRef; years: number[] }`
  - `FacultyOptions { faculty; programmes: ProgrammeOption[] }`
  - `ImpersonationSelection { programId; shortCode; name; faculty; year: number; group: number | null; rozvrh: RozvrhRef; periodLabel: string }`
  - `ImpersonationResult { plan: DualLanguageStudyPlan; schedule: BlockLesson[]; subjects: SubjectsData; fetchedAt: number }`
  - `ImpersonationErrorCode = 'options' | 'timetable' | 'noPlan' | 'noSemester' | 'expired' | 'notAdmin'`
  - `class ImpersonationError extends Error { code }`
- `text.ts`: `txt(el)`, `parseDoc(html)`
- `intake.ts`: `Period`, `currentPeriod(now)`, `periodLabel(p)`, `intakeLabel(year, now)`, `targetSemester(year, now)`

- [ ] **Step 1: Write the failing test**

`src/api/impersonation/__tests__/intake.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { currentPeriod, periodLabel, intakeLabel, targetSemester } from '../intake';

// IS lists next semester first every September, so the period must come from
// the date. Same rule as reis-scraper's currentPeriodLabel.
describe('intake math', () => {
  it('September–January is ZS of Y/Y+1', () => {
    expect(periodLabel(currentPeriod(new Date(2026, 8, 26)))).toBe('ZS 2026/2027');
    expect(periodLabel(currentPeriod(new Date(2027, 0, 15)))).toBe('ZS 2026/2027');
  });
  it('February–August is LS of Y-1/Y', () => {
    expect(periodLabel(currentPeriod(new Date(2027, 2, 1)))).toBe('LS 2026/2027');
    expect(periodLabel(currentPeriod(new Date(2027, 7, 31)))).toBe('LS 2026/2027');
  });
  it('a year-N student follows the winter intake N-1 years back', () => {
    expect(intakeLabel(1, new Date(2026, 8, 26))).toBe('ZS 2026/2027');
    expect(intakeLabel(2, new Date(2026, 8, 26))).toBe('ZS 2025/2026');
    expect(intakeLabel(1, new Date(2027, 2, 1))).toBe('ZS 2026/2027');
  });
  it('target semester is 2y-1 in ZS and 2y in LS', () => {
    expect(targetSemester(1, new Date(2026, 8, 26))).toBe(1);
    expect(targetSemester(2, new Date(2026, 8, 26))).toBe(3);
    expect(targetSemester(1, new Date(2027, 2, 1))).toBe(2);
    expect(targetSemester(3, new Date(2027, 2, 1))).toBe(6);
  });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/api/impersonation/__tests__/intake.test.ts`
Expected: FAIL, "Failed to resolve import '../intake'".

- [ ] **Step 3: Implement**

`src/api/impersonation/intake.ts`:

```ts
/** A teaching period. `ZS 2026` is "ZS 2026/2027"; `LS 2026` is "LS 2026/2027". */
export interface Period {
  term: 'ZS' | 'LS';
  startYear: number;
}

/**
 * September–January is ZS of Y/Y+1, February–August is LS of Y-1/Y.
 * From the date, never from IS's period list: IS lists the next semester first
 * every September (reis-scraper `currentPeriodLabel` learned this the hard way).
 */
export function currentPeriod(now: Date): Period {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 9) return { term: 'ZS', startYear: y };
  if (m === 1) return { term: 'ZS', startYear: y - 1 };
  return { term: 'LS', startYear: y - 1 };
}

export function periodLabel(p: Period): string {
  return `${p.term} ${p.startYear}/${p.startYear + 1}`;
}

/** The winter intake a year-`year` student started in (v1: winter intakes only). */
export function intakeLabel(year: number, now: Date): string {
  const p = currentPeriod(now);
  return periodLabel({ term: 'ZS', startYear: p.startYear - (year - 1) });
}

/** The plan semester a year-`year` student is in right now. */
export function targetSemester(year: number, now: Date): number {
  return currentPeriod(now).term === 'ZS' ? 2 * year - 1 : 2 * year;
}
```

`src/api/impersonation/text.ts`:

```ts
// IS pads cells with U+00A0; normalise so label matches and regexes work.
const NBSP = / /g;

export const txt = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(NBSP, ' ').replace(/\s+/g, ' ').trim();

export const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');
```

`src/api/impersonation/types.ts`:

```ts
import type { BlockLesson } from '../../types/schedule';
import type { DualLanguageStudyPlan } from '../../types/studyPlan';
import type { SubjectsData } from '../../types/documents';

/** One timetable (rozvrh) of the timetable app, with the z/k/f triple IS wants back. */
export interface RozvrhRef {
  id: string;
  z: string;
  k: string;
  label: string;
  period: string;
  /** Pracoviště short name, e.g. 'PEF'. */
  faculty: string;
  /** 'prezenční' | 'kombinovaná' */
  form: string;
  /** Validity start/end as IS prints them, DD.MM.YYYY — also the konani_od/do range. */
  start: string;
  end: string;
}

export interface ProgrammeOption {
  programId: string;
  shortCode: string;
  name: string;
  faculty: string;
  rozvrh: RozvrhRef;
  years: number[];
}

export interface FacultyOptions {
  faculty: string;
  programmes: ProgrammeOption[];
}

export interface ImpersonationSelection {
  programId: string;
  shortCode: string;
  name: string;
  faculty: string;
  year: number;
  /** Year-1 study group (IS `skupina`); null = all groups / no groups. */
  group: number | null;
  rozvrh: RozvrhRef;
  /** The period this was fetched for, e.g. 'ZS 2026/2027'. A mismatch at boot ends it. */
  periodLabel: string;
}

export interface ImpersonationResult {
  plan: DualLanguageStudyPlan;
  schedule: BlockLesson[];
  subjects: SubjectsData;
  fetchedAt: number;
}

export type ImpersonationErrorCode =
  | 'options'
  | 'timetable'
  | 'noPlan'
  | 'noSemester'
  | 'expired'
  | 'notAdmin';

export class ImpersonationError extends Error {
  constructor(readonly code: ImpersonationErrorCode) {
    super(`impersonation:${code}`);
  }
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/api/impersonation/__tests__/intake.test.ts && npm run typecheck`
Expected: PASS, and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/api/impersonation/types.ts src/api/impersonation/text.ts src/api/impersonation/intake.ts src/api/impersonation/__tests__/intake.test.ts
git commit -m "feat(impersonation): shared types and intake/semester math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Catalogue plan parser

**Files:**
- Create: `src/api/impersonation/catalogPlan.ts`
- Test: `src/api/impersonation/__tests__/catalogPlan.test.ts`

**Interfaces:**
- Consumes: `txt`, `parseDoc` from `text.ts`.
- Produces:
  - `CatalogRow { code; name; completion; credits: number; predmetId: string | null }`
  - `CatalogGroup { name; minCredits?; minCount?; rows: CatalogRow[] }`
  - `CatalogSemester { number; title; groups: CatalogGroup[] }`
  - `parseCatalogPlan(doc: Document): CatalogSemester[]`
  - `subjectsToAttend(sem: CatalogSemester): CatalogRow[]`
  - `toStudyPlan(semesters, title, enrolled: { semester: number; codes: Set<string> }): StudyPlan`

Structure evidence, from the real 801 leaf:
- A semester opens with a `<tr>` whose single `td colspan="4"` holds `<b>`: "1. semestr ZS 2025/2026 - PEF", or in EN "1st semester WS 2025/2026 - FBE".
- A group opens with `<td>&nbsp;</td><td colspan="3"><b>Skupina předmětů povinných</b></td>`, or in EN "A group of required courses".
- Subject rows carry class `predmety_vse` and four cells: code (with a `syllabus.pl?predmet=N` link), name, completion, credits.
- The header row carries class `zahlavi`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCatalogPlan, subjectsToAttend, toStudyPlan } from '../catalogPlan';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8'));

// Real B-F Finance leaf, intake ZS 2025/2026 (stud_plan 12490), fetched 2026-09-26.
describe('parseCatalogPlan', () => {
  const cz = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'));
  const en = parseCatalogPlan(fx('catalog-plan-bf-801.en.html'));

  it('reads all six semesters in both languages', () => {
    expect(cz.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(en.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cz[0]!.title).toBe('1. semestr ZS 2025/2026 - PEF');
    expect(en[2]!.title).toBe('3rd semester WS 2026/2027 - FBE');
  });

  it('reads semester 3: five required subjects and a min-2-credit elective group', () => {
    const s3 = cz[2]!;
    expect(s3.groups.map((g) => g.name)).toEqual([
      'Skupina předmětů povinných',
      'Skupina předmětů povinně volitelných (min. 2 kr.)',
    ]);
    expect(s3.groups[0]!.rows.map((r) => r.code)).toEqual([
      'EBC-AZD', 'EBC-FT', 'EBC-FU', 'EBC-MA', 'EBC-MAR',
    ]);
    expect(s3.groups[1]!.minCredits).toBe(2);
    expect(s3.groups[1]!.rows.map((r) => r.code)).toEqual(['EBA-OTDU', 'EBA-OTF']);
  });

  it("links THIS period's subject ids for the semester being taught now", () => {
    // Equal to timetable 5769's predmet ids — the join the year-2+ path relies on.
    const ft = cz[2]!.groups[0]!.rows.find((r) => r.code === 'EBC-FT')!;
    expect(ft.predmetId).toBe('164066');
    expect(ft.credits).toBeGreaterThan(0);
    expect(ft.completion).not.toBe('');
  });
});

describe('subjectsToAttend', () => {
  const s3 = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'))[2]!;
  it('takes every required subject and fills electives up to the group minimum', () => {
    const codes = subjectsToAttend(s3).map((r) => r.code);
    expect(codes.slice(0, 5)).toEqual(['EBC-AZD', 'EBC-FT', 'EBC-FU', 'EBC-MA', 'EBC-MAR']);
    expect(codes).toContain('EBA-OTDU');
    expect(codes).not.toContain('EBA-OTF');
  });
  it('never picks the 999-credit EXA-UP placeholders', () => {
    const s5 = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'))[4]!;
    expect(subjectsToAttend(s5).some((r) => r.code.startsWith('EXA-UP'))).toBe(false);
  });
});

describe('toStudyPlan', () => {
  it('maps to the StudyPlan shape and marks only the chosen current subjects enrolled', () => {
    const sems = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'));
    const plan = toStudyPlan(sems, 'B-F Finance', { semester: 3, codes: new Set(['EBC-FT']) });
    expect(plan.blocks).toHaveLength(6);
    const all = plan.blocks.flatMap((b) => b.groups.flatMap((g) => g.subjects));
    expect(all.filter((s) => s.isEnrolled).map((s) => s.code)).toEqual(['EBC-FT']);
    expect(all.every((s) => !s.isFulfilled && s.enrollmentCount === 0)).toBe(true);
    expect(plan.blocks[2]!.groups[1]!.minCredits).toBe(2);
    expect(plan.creditsRequired).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/api/impersonation/__tests__/catalogPlan.test.ts`
Expected: FAIL, "Failed to resolve import '../catalogPlan'".

- [ ] **Step 3: Implement**

`src/api/impersonation/catalogPlan.ts`:

```ts
import type { StudyPlan, SemesterBlock, SubjectGroup } from '../../types/studyPlan';
import { txt } from './text';

export interface CatalogRow {
  code: string;
  name: string;
  completion: string;
  credits: number;
  /** This period's IS subject id — present only for semesters taught now. */
  predmetId: string | null;
}

export interface CatalogGroup {
  name: string;
  minCredits?: number;
  minCount?: number;
  rows: CatalogRow[];
}

export interface CatalogSemester {
  number: number;
  title: string;
  groups: CatalogGroup[];
}

/** "1. semestr ZS 2025/2026 - PEF" / "3rd semester WS 2026/2027 - FBE" */
const SEMESTER_RE = /^(\d+)(?:\.|st|nd|rd|th)\s*(?:semestr|semester)\b/i;
/** Placeholder rows ("Uznaný předmět ze zahraničního výjezdu") carry 999 credits. */
const PLACEHOLDER_CREDITS = 999;

function parseMinimum(name: string): Pick<CatalogGroup, 'minCredits' | 'minCount'> {
  const credits = /min\.\s*(\d+)\s*(?:kr|crd)/i.exec(name);
  if (credits) return { minCredits: Number(credits[1]) };
  const count = /min\.\s*(\d+)\s*(?:př|cours|subj)/i.exec(name);
  return count ? { minCount: Number(count[1]) } : {};
}

/**
 * The public catalogue plan leaf (`/katalog/plany.pl?…;stud_plan=N`).
 * Same structure reis-scraper's `parsePlan` reads, verified on the 801/829 B-F
 * leaves in both languages (fixtures/catalog-plan-bf-801.*.html).
 */
export function parseCatalogPlan(doc: Document): CatalogSemester[] {
  const out: CatalogSemester[] = [];
  let sem: CatalogSemester | null = null;
  let group: CatalogGroup | null = null;
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cls = tr.getAttribute('class') ?? '';
    if (cls.includes('zahlavi')) continue;
    if (!cls.includes('predmety_vse')) {
      const t = txt(tr);
      const m = SEMESTER_RE.exec(t);
      if (m && tr.querySelector('td[colspan="4"] b')) {
        sem = { number: Number(m[1]), title: t, groups: [] };
        out.push(sem);
        group = null;
      } else if (sem && tr.querySelector('td[colspan="3"] b')) {
        group = { name: t, rows: [], ...parseMinimum(t) };
        sem.groups.push(group);
      }
      continue;
    }
    if (!group) continue;
    const cells = Array.from(tr.querySelectorAll('td')).filter(
      (td) => !(td.getAttribute('class') ?? '').includes('UISTMNumberCellHidden')
    );
    if (cells.length < 4) continue;
    const code = txt(cells[0]);
    if (!code) continue;
    const credits = Number(txt(cells[3]).replace(',', '.'));
    const href = cells[0]!.querySelector('a')?.getAttribute('href') ?? '';
    const predmet = /predmet=(\d+)/.exec(href);
    group.rows.push({
      code,
      name: txt(cells[1]),
      completion: txt(cells[2]),
      credits: Number.isFinite(credits) ? credits : 0,
      predmetId: predmet ? predmet[1]! : null,
    });
  }
  return out;
}

/** What a real student of this semester attends: all required, electives up to the minimum. */
export function subjectsToAttend(sem: CatalogSemester): CatalogRow[] {
  const out: CatalogRow[] = [];
  for (const g of sem.groups) {
    const rows = g.rows.filter((r) => r.credits < PLACEHOLDER_CREDITS);
    if (g.minCredits !== undefined) {
      let sum = 0;
      for (const r of rows) {
        if (sum >= g.minCredits) break;
        out.push(r);
        sum += r.credits;
      }
    } else if (g.minCount !== undefined) {
      out.push(...rows.slice(0, g.minCount));
    } else if (!/volitel|elective|optional/i.test(g.name)) {
      out.push(...rows);
    }
  }
  return out;
}

export function toStudyPlan(
  semesters: CatalogSemester[],
  title: string,
  enrolled: { semester: number; codes: Set<string> }
): StudyPlan {
  let creditsRequired = 0;
  const blocks: SemesterBlock[] = semesters.map((s) => ({
    title: s.title,
    groups: s.groups.map((g): SubjectGroup => {
      const real = g.rows.filter((r) => r.credits < PLACEHOLDER_CREDITS);
      creditsRequired +=
        g.minCredits ?? (/volitel|elective|optional/i.test(g.name) ? 0 : real.reduce((a, r) => a + r.credits, 0));
      return {
        name: g.name,
        statusDescription: '',
        ...(g.minCount !== undefined ? { minCount: g.minCount } : {}),
        ...(g.minCredits !== undefined ? { minCredits: g.minCredits } : {}),
        subjects: g.rows.map((r) => ({
          id: r.predmetId ?? r.code,
          code: r.code,
          name: r.name,
          credits: r.credits,
          type: r.completion,
          isEnrolled: s.number === enrolled.semester && enrolled.codes.has(r.code),
          isFulfilled: false,
          enrollmentCount: 0,
          rawStatusText: '',
        })),
      };
    }),
  }));
  return { title, isFulfilled: false, creditsAcquired: 0, creditsRequired, blocks };
}
```

If `en[2].title` fails because EN uses a different heading cell, open the fixture and adjust **the test's expectation to what the real page says**, not the parser's guard. If a group heading isn't in `td[colspan="3"] b` in EN, check the real EN fixture and match the structure it actually has.

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx vitest run src/api/impersonation/__tests__/catalogPlan.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/impersonation/catalogPlan.ts src/api/impersonation/__tests__/catalogPlan.test.ts
git commit -m "feat(impersonation): parse the public catalogue study plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Catalogue navigation and timetable-form parsers

**Files:**
- Create: `src/api/impersonation/catalogNav.ts`, `src/api/impersonation/timetableForm.ts`
- Test: `src/api/impersonation/__tests__/catalogNav.test.ts`, `src/api/impersonation/__tests__/timetableForm.test.ts`

**Interfaces (produces):**
- `catalogNav.ts`:
  - `CATALOG_URL`
  - `FACULTY_IDS: Record<string, string>`, which is `{ PEF: '2', AF: '14', FRRMS: '23', LDF: '38', ZF: '60' }`
  - `typStudiaFor(shortCode): '1' | '4' | null`
  - `findPeriodPoc(doc, label): string | null`
  - `programmeUrl(fakulta, poc, typStudia, programId): string`
  - `findLeafUrl(doc): string | null` (absolute URL, lang=cz)
- `timetableForm.ts`:
  - `RangeRef { z; k }`
  - `parseRanges(doc): RangeRef[]`
  - `pickCurrentRange(ranges, now): RangeRef | null`
  - `parseRozvrhRows(doc, range): RozvrhRef[]`
  - `CriteriaProgramme { programId; shortCode; name }`
  - `parseCriteria(doc): { programmes: CriteriaProgramme[]; years: number[] }`
  - `parseGroupNumbers(doc, year): number[]`

- [ ] **Step 1: Write the failing tests**

`src/api/impersonation/__tests__/catalogNav.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { findPeriodPoc, findLeafUrl, programmeUrl, typStudiaFor } from '../catalogNav';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8'));

describe('catalogue navigation (real PEF catalogue pages, 2026-09-26)', () => {
  it('finds the intake period id by its exact label', () => {
    const d = fx('catalog-periods-pef.html');
    expect(findPeriodPoc(d, 'ZS 2026/2027')).toBe('829');
    expect(findPeriodPoc(d, 'ZS 2025/2026')).toBe('801');
    // "ZS 2012/2013 - CV" must not satisfy "ZS 2012/2013".
    expect(findPeriodPoc(d, 'ZS 2012/2013')).toBe('313');
  });
  it('finds the prezenční plan leaf on the programme page', () => {
    const url = findLeafUrl(fx('catalog-programme-bf-801.html'));
    expect(url).toContain('stud_plan=12490');
    expect(url).toMatch(/^https:\/\/is\.mendelu\.cz\/katalog\/plany\.pl\?/);
    expect(url).not.toContain('predmety_sz');
  });
  it('builds the programme URL IS expects', () => {
    expect(programmeUrl('2', '801', '1', '1889')).toBe(
      'https://is.mendelu.cz/katalog/plany.pl?fakulta=2;poc_obdobi=801;typ_ss=;typ_studia=1;program=1889;misto_vyuky=;lang=cz'
    );
  });
  it('maps short codes to study types (v1: B- and N- only)', () => {
    expect(typStudiaFor('B-F')).toBe('1');
    expect(typStudiaFor('N-F')).toBe('4');
    expect(typStudiaFor('Z-EXC')).toBeNull();
  });
});
```

`src/api/impersonation/__tests__/timetableForm.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseRanges, pickCurrentRange, parseRozvrhRows, parseCriteria, parseGroupNumbers,
} from '../timetableForm';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8'));

describe('timetable app pages (real, trimmed, 2026-09-26)', () => {
  it('lists validity ranges and picks the one containing today', () => {
    const ranges = parseRanges(fx('rozvrh-index.html'));
    expect(ranges).toContainEqual({ z: '20260921', k: '20261213' });
    expect(pickCurrentRange(ranges, new Date(2026, 8, 26))).toEqual({ z: '20260921', k: '20261213' });
    expect(pickCurrentRange(ranges, new Date(2027, 5, 1))).toBeNull();
  });
  it('reads rozvrh rows with faculty, form and validity', () => {
    const rows = parseRozvrhRows(fx('rozvrh-range.html'), { z: '20260921', k: '20261213' });
    const pef = rows.find((r) => r.id === '5769')!;
    expect(pef).toMatchObject({
      faculty: 'PEF', form: 'prezenční', period: 'ZS 2026/2027',
      start: '21.09.2026', end: '20.12.2026', z: '20260921', k: '20261213',
    });
    expect(rows.find((r) => r.id === '5770')?.form).toBe('kombinovaná');
  });
  it('reads programmes and years from the criteria form', () => {
    const form = parseCriteria(fx('rozvrh-criteria.html'));
    expect(form.programmes).toContainEqual({ programId: '1889', shortCode: 'B-F', name: 'Finance' });
    expect(form.years).toEqual([1, 2, 3]);
  });
  it('reads year-1 study groups from the list format Omezení column', () => {
    // Real labels: 1b-f (lecture, no group) and 1b-f1 … 1b-f5.
    expect(parseGroupNumbers(fx('rozvrh-list-bf-y1.html'), 1)).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx vitest run src/api/impersonation/__tests__/catalogNav.test.ts src/api/impersonation/__tests__/timetableForm.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement**

`src/api/impersonation/catalogNav.ts`:

```ts
import { BASE_URL } from '../client';
import { txt } from './text';

export const CATALOG_URL = `${BASE_URL}/katalog/plany.pl`;

/** Catalogue `fakulta=` ids by the timetable's Pracoviště short name (reis-scraper FACULTIES). */
export const FACULTY_IDS: Record<string, string> = {
  PEF: '2',
  AF: '14',
  FRRMS: '23',
  LDF: '38',
  ZF: '60',
};

/** typ_studia: 1 = bachelor, 4 = follow-up master (reis-scraper schema). */
export function typStudiaFor(shortCode: string): '1' | '4' | null {
  if (shortCode.startsWith('B-')) return '1';
  if (shortCode.startsWith('N-')) return '4';
  return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The `poc_obdobi` of the row labelled exactly `label` ("ZS 2025/2026", not "… - CV"). */
export function findPeriodPoc(doc: Document, label: string): string | null {
  const re = new RegExp(`^${escape(label)}(?!\\s*-)`);
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const a = tr.querySelector('a[href*="poc_obdobi="]');
    if (!a || !re.test(txt(tr))) continue;
    const m = /poc_obdobi=(\d+)/.exec(a.getAttribute('href') ?? '');
    if (m) return m[1]!;
  }
  return null;
}

/** IS separates parameters with `;` — `&` silently returns the faculty index. */
export function programmeUrl(fakulta: string, poc: string, typStudia: string, programId: string): string {
  return `${CATALOG_URL}?fakulta=${fakulta};poc_obdobi=${poc};typ_ss=;typ_studia=${typStudia};program=${programId};misto_vyuky=;lang=cz`;
}

const absolute = (href: string): string =>
  href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/katalog/'}${href.replace(/^\.\//, '')}`;

/** The prezenční (`forma=1`) plan leaf; the `predmety_sz` link is the state-exam list. */
export function findLeafUrl(doc: Document): string | null {
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    if (/forma=1;/.test(href) && /stud_plan=\d+/.test(href) && !href.includes('predmety_sz'))
      return absolute(href);
  }
  return null;
}
```

`src/api/impersonation/timetableForm.ts`:

```ts
import type { RozvrhRef } from './types';
import { txt } from './text';

export interface RangeRef {
  z: string;
  k: string;
}

export interface CriteriaProgramme {
  programId: string;
  shortCode: string;
  name: string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Validity ranges linked from `rozvrhy_view.pl?konf=1`. */
export function parseRanges(doc: Document): RangeRef[] {
  const out: RangeRef[] = [];
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const m = /z=(\d{8});k=(\d{8})/.exec(a.getAttribute('href') ?? '');
    if (m && !out.some((r) => r.z === m[1] && r.k === m[2])) out.push({ z: m[1]!, k: m[2]! });
  }
  return out;
}

export function pickCurrentRange(ranges: RangeRef[], now: Date): RangeRef | null {
  const today = ymd(now);
  return ranges.find((r) => r.z <= today && today <= r.k) ?? null;
}

/** Rows: checkbox | Rozvrh | Období | Pracoviště | Forma | Začátek | Konec (real header). */
export function parseRozvrhRows(doc: Document, range: RangeRef): RozvrhRef[] {
  const out: RozvrhRef[] = [];
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cb = tr.querySelector('input[name="rozvrh"]');
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => txt(td));
    if (!cb || cells.length < 7) continue;
    out.push({
      id: cb.getAttribute('value') ?? '',
      z: range.z,
      k: range.k,
      label: cells[1]!,
      period: cells[2]!,
      faculty: cells[3]!,
      form: cells[4]!,
      start: cells[5]!,
      end: cells[6]!,
    });
  }
  return out;
}

const option = (o: Element) => ({ value: o.getAttribute('value') ?? '', label: txt(o) });

export function parseCriteria(doc: Document): { programmes: CriteriaProgramme[]; years: number[] } {
  const programmes: CriteriaProgramme[] = [];
  for (const o of Array.from(doc.querySelectorAll('select[name="program"] option')).map(option)) {
    if (!o.value || o.value === '0') continue;
    const [shortCode, ...rest] = o.label.split(' ');
    if (!shortCode || !/^[A-Z]{1,3}-[A-Z0-9]+$/.test(shortCode)) continue;
    programmes.push({ programId: o.value, shortCode, name: rest.join(' ') });
  }
  const years = Array.from(doc.querySelectorAll('select[name="rocnik"] option'))
    .map((o) => Number(o.getAttribute('value')))
    .filter((n) => Number.isInteger(n) && n > 0);
  return { programmes, years };
}

/**
 * Study-group numbers of year `year`, from the `format=list` table's Omezení
 * column (the JSON has no group field). Located by header text, as reis-scraper
 * does: IS drops the column on timetables without groups. "1b-f2" → 2.
 */
export function parseGroupNumbers(doc: Document, year: number): number[] {
  const groups = new Set<number>();
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const trs = Array.from(table.querySelectorAll('tr'));
    const headIdx = trs.findIndex((tr) => {
      const h = Array.from(tr.querySelectorAll('th,td')).map((c) => txt(c));
      return h.includes('Den') && h.includes('Omezení');
    });
    if (headIdx === -1) continue;
    const col = Array.from(trs[headIdx]!.querySelectorAll('th,td')).map((c) => txt(c)).indexOf('Omezení');
    for (const tr of trs.slice(headIdx + 1)) {
      const label = txt(tr.querySelectorAll('td')[col]);
      const m = /^(\d+)[a-z]*-[a-z]+(\d+)$/i.exec(label);
      if (m && Number(m[1]) === year) groups.add(Number(m[2]));
    }
  }
  return [...groups].sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx vitest run src/api/impersonation/__tests__/catalogNav.test.ts src/api/impersonation/__tests__/timetableForm.test.ts && npm run typecheck`
Expected: PASS. If `findPeriodPoc(d, 'ZS 2012/2013')` is not `313`, read the real fixture row and correct the test's expected id; the label logic is what's under test.

- [ ] **Step 5: Commit**

```bash
git add src/api/impersonation/catalogNav.ts src/api/impersonation/timetableForm.ts src/api/impersonation/__tests__/catalogNav.test.ts src/api/impersonation/__tests__/timetableForm.test.ts
git commit -m "feat(impersonation): catalogue navigation and timetable form parsers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Timetable query, response classifier, dual-language merge, first-slot pick

**Files:**
- Modify: `src/api/schedule.ts`. Export `NO_RESULTS_MARKERS`, extract `mergeDualLanguageLessons`, and use it in `fetchDualLanguageSchedule`.
- Create: `src/api/impersonation/timetableQuery.ts`, `src/api/impersonation/pickSlots.ts`
- Test: `src/api/impersonation/__tests__/timetableQuery.test.ts`, `src/api/impersonation/__tests__/pickSlots.test.ts`. The existing `src/api/__tests__/scheduleDualLanguage.test.ts` must still pass.

**Interfaces:**
- Consumes: `RozvrhRef`.
- Produces:
  - `schedule.ts`: `NO_RESULTS_MARKERS`, `mergeDualLanguageLessons(cz: BlockLesson[], en: BlockLesson[]): BlockLesson[]`
  - `timetableQuery.ts`:
    - `TIMETABLE_URL`
    - `TimetableFilter { program?; rocnik?; skupina?; predmet? }`
    - `timetableBody(r, f, lang, format): string`
    - `criteriaBody(r): string`
    - `TimetableAnswer` = `{ kind: 'lessons'; lessons: BlockLesson[] } | { kind: 'empty' } | { kind: 'failed' }`
    - `readTimetableAnswer(text): TimetableAnswer`
  - `pickSlots.ts`: `firstSlotOnly(lessons: BlockLesson[]): BlockLesson[]`

- [ ] **Step 1: Write the failing tests**

`src/api/impersonation/__tests__/timetableQuery.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { timetableBody, criteriaBody, readTimetableAnswer } from '../timetableQuery';
import { mergeDualLanguageLessons } from '../../schedule';
import type { RozvrhRef } from '../types';

const raw = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const R: RozvrhRef = {
  id: '5769', z: '20260921', k: '20261213', label: 'Prezenční forma', period: 'ZS 2026/2027',
  faculty: 'PEF', form: 'prezenční', start: '21.09.2026', end: '20.12.2026',
};

describe('timetableBody', () => {
  it('asks for dated JSON over the rozvrh validity (verified live 2026-09-26)', () => {
    const p = new URLSearchParams(timetableBody(R, { program: '1889', rocnik: 1, skupina: 2 }, 'en', 'json'));
    expect(Object.fromEntries(p)).toMatchObject({
      lang: 'en', rozvrh: '5769', z: '20260921', k: '20261213', f: '0', program: '1889',
      rocnik: '1', skupina: '2', predmet: '0', format: 'json', typ_vypisu: 'konani',
      konani_od: '21.09.2026', konani_do: '20.12.2026', zobraz: 'Zobrazit',
    });
  });
  it('list format carries no konani range', () => {
    const p = new URLSearchParams(timetableBody(R, { program: '1889', rocnik: 1 }, 'cz', 'list'));
    expect(p.get('format')).toBe('list');
    expect(p.has('typ_vypisu')).toBe(false);
  });
  it('criteria body posts only the rozvrh selection', () => {
    expect(Object.fromEntries(new URLSearchParams(criteriaBody(R)))).toEqual({
      lang: 'cz', z: '20260921', k: '20261213', f: '0', studijni_zpet: '0', rozvrh: '5769',
    });
  });
});

describe('readTimetableAnswer', () => {
  it('reads real dated JSON into student-shaped lessons', () => {
    const a = readTimetableAnswer(raw('src/api/impersonation/__tests__/fixtures/rozvrh-bf-y1-g2.cz.json'));
    expect(a.kind).toBe('lessons');
    if (a.kind !== 'lessons') return;
    expect(a.lessons.length).toBeGreaterThan(0);
    expect(a.lessons[0]).toMatchObject({ studyId: '', periodId: '' });
    expect(new Set(a.lessons.map((l) => l.courseCode))).toContain('EBC-MT');
  });
  it('treats the real no-results page as empty, in either language', () => {
    expect(readTimetableAnswer(raw('src/api/__tests__/fixtures/is-rozvrh-no-results.html')).kind).toBe('empty');
    expect(readTimetableAnswer(raw('src/api/__tests__/fixtures/is-rozvrh-no-results-en.html')).kind).toBe('empty');
  });
  it('treats anything else (login page, error) as failed — never as empty', () => {
    expect(readTimetableAnswer('<html>login</html>').kind).toBe('failed');
    expect(readTimetableAnswer('{not json').kind).toBe('failed');
  });
});

describe('mergeDualLanguageLessons', () => {
  it('adds EN names to CZ lessons by id+date+start', () => {
    const cz = readTimetableAnswer(raw('src/api/impersonation/__tests__/fixtures/rozvrh-bf-y1-g2.cz.json'));
    const en = readTimetableAnswer(raw('src/api/impersonation/__tests__/fixtures/rozvrh-bf-y1-g2.en.json'));
    if (cz.kind !== 'lessons' || en.kind !== 'lessons') throw new Error('fixture');
    const merged = mergeDualLanguageLessons(cz.lessons, en.lessons);
    const mt = merged.find((l) => l.courseCode === 'EBC-MT')!;
    expect(mt.courseNameCs).toBe('Matematika');
    expect(mt.courseNameEn).not.toBe('Matematika');
  });
});
```

`src/api/impersonation/__tests__/pickSlots.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { firstSlotOnly } from '../pickSlots';
import { readTimetableAnswer } from '../timetableQuery';

// Real EBC-FT dated timetable, all parallels (predmet=164066), ZS 2026/27.
// 60 lessons: lectures Thu 09:00 Q02 (12) and seminars in four slots.
const a = readTimetableAnswer(
  readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures/rozvrh-predmet-ft.cz.json'), 'utf8')
);

describe('firstSlotOnly', () => {
  it('keeps the lecture slot and the earliest seminar slot only', () => {
    if (a.kind !== 'lessons') throw new Error('fixture');
    expect(a.lessons).toHaveLength(60);
    const kept = firstSlotOnly(a.lessons);
    const slots = new Set(kept.map((l) => `${l.isSeminar}|${l.startTime}|${l.room}`));
    expect(slots).toEqual(new Set(['false|09:00|Q02', 'true|09:00|Q31']));
    expect(kept.every((l) => new Date(`${l.date.slice(0, 4)}-${l.date.slice(4, 6)}-${l.date.slice(6)}`).getUTCDay() === (l.isSeminar === 'true' ? 2 : 4))).toBe(true);
  });
  it('returns [] for []', () => expect(firstSlotOnly([])).toEqual([]));
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx vitest run src/api/impersonation/__tests__/timetableQuery.test.ts src/api/impersonation/__tests__/pickSlots.test.ts`
Expected: FAIL, unresolved imports and `mergeDualLanguageLessons` not exported.

- [ ] **Step 3: Implement**

In `src/api/schedule.ts`, change `const NO_RESULTS_MARKERS = [` to `export const NO_RESULTS_MARKERS = [`. Add this exported function above `fetchDualLanguageSchedule`:

```ts
/** CZ lessons as the base, EN names/rooms joined on id + date + start time. */
export function mergeDualLanguageLessons(czLessons: BlockLesson[], enLessons: BlockLesson[]): BlockLesson[] {
  const enMap = new Map<string, BlockLesson>();
  for (const lesson of enLessons) enMap.set(`${lesson.id}_${lesson.date}_${lesson.startTime}`, lesson);
  return czLessons.map((czLesson) => {
    const enLesson = enMap.get(`${czLesson.id}_${czLesson.date}_${czLesson.startTime}`);
    return {
      ...czLesson,
      courseNameCs: czLesson.courseName,
      courseNameEn: enLesson?.courseName || czLesson.courseName,
      roomCs: czLesson.room,
      roomEn: enLesson?.room || czLesson.room,
    };
  });
}
```

Then replace the body of `fetchDualLanguageSchedule` between `if (!czLessons || !enLessons) return null;` and `return merged;` with `return mergeDualLanguageLessons(czLessons, enLessons);`, keeping the try/catch.

`src/api/impersonation/timetableQuery.ts`:

```ts
import { BASE_URL } from '../client';
import { NO_RESULTS_MARKERS } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import type { RozvrhRef } from './types';

export const TIMETABLE_URL = `${BASE_URL}/auth/katalog/rozvrhy_view.pl`;

export interface TimetableFilter {
  program?: string;
  rocnik?: number;
  skupina?: number;
  predmet?: string;
}

/** The criteria form POST; the triple must match how the rozvrh was reached. */
export function criteriaBody(r: RozvrhRef): string {
  return new URLSearchParams({ lang: 'cz', z: r.z, k: r.k, f: '0', studijni_zpet: '0', rozvrh: r.id }).toString();
}

/**
 * `format=json` is not offered by the form, but IS honours it (verified
 * 2026-09-26): with `typ_vypisu=konani` it returns the same dated `blockLessons`
 * the student's own timetable does, holidays already removed.
 */
export function timetableBody(
  r: RozvrhRef,
  f: TimetableFilter,
  lang: 'cz' | 'en',
  format: 'json' | 'list'
): string {
  const p = new URLSearchParams({
    lang, z: r.z, k: r.k, f: '0', studijni_zpet: '0', rozvrh: r.id,
    mistnost: '0', garant: '0', ucitel: '0', predmet: f.predmet ?? '0', ustav: '0', den: '0',
    stupen: '0', program: f.program ?? '0', obor: '0', rocnik: String(f.rocnik ?? 0),
    skupina: String(f.skupina ?? 0), zobraz: 'Zobrazit', format,
  });
  if (format === 'json') {
    p.set('typ_vypisu', 'konani');
    p.set('konani_od', r.start);
    p.set('konani_do', r.end);
  }
  return p.toString();
}

export type TimetableAnswer =
  | { kind: 'lessons'; lessons: BlockLesson[] }
  | { kind: 'empty' }
  | { kind: 'failed' };

/**
 * By BODY, not content-type: the extension's proxy labels every response
 * text/html. Same failure/emptiness rule as schedule.ts — the no-results
 * sentence is the only thing that makes non-JSON an honest "nothing".
 */
export function readTimetableAnswer(text: string): TimetableAnswer {
  if (text.trimStart().startsWith('{')) {
    try {
      const d = JSON.parse(text) as { blockLessons?: Omit<BlockLesson, 'studyId' | 'periodId'>[] };
      return { kind: 'lessons', lessons: (d.blockLessons ?? []).map((l) => ({ ...l, studyId: '', periodId: '' })) };
    } catch {
      return { kind: 'failed' };
    }
  }
  return NO_RESULTS_MARKERS.some((m) => text.includes(m)) ? { kind: 'empty' } : { kind: 'failed' };
}
```

`src/api/impersonation/pickSlots.ts`:

```ts
import type { BlockLesson } from '../../types/schedule';

const weekday = (yyyymmdd: string) =>
  new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8))).getUTCDay();

/**
 * A per-subject dated query merges parallels that share a slot, and their teacher
 * lists vary week to week, so the slot key is weekday + start + room (real EBC-FT
 * data, 2026-09-26). A biweekly parallel therefore shows weekly — known v1 limit.
 */
const slotKey = (l: BlockLesson) => `${weekday(l.date)}|${l.startTime}|${l.roomStructured?.id ?? l.room}`;

/** One parallel per lesson type: the slot of the earliest lecture and of the earliest seminar. */
export function firstSlotOnly(lessons: BlockLesson[]): BlockLesson[] {
  const sorted = [...lessons].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const chosen = new Map<string, string>();
  for (const l of sorted) if (!chosen.has(l.isSeminar)) chosen.set(l.isSeminar, slotKey(l));
  return sorted.filter((l) => chosen.get(l.isSeminar) === slotKey(l));
}
```

- [ ] **Step 4: Run the tests and check that they pass, including the existing schedule tests**

Run: `npx vitest run src/api/impersonation src/api/__tests__/scheduleDualLanguage.test.ts src/api/__tests__/scheduleEmptyWindow.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/schedule.ts src/api/impersonation/timetableQuery.ts src/api/impersonation/pickSlots.ts src/api/impersonation/__tests__/timetableQuery.test.ts src/api/impersonation/__tests__/pickSlots.test.ts
git commit -m "feat(impersonation): timetable query, response classifier and first-slot pick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Orchestrator: options, groups, full fetch

**Files:**
- Create: `src/api/impersonation/fetchImpersonation.ts`
- Test: `src/api/impersonation/__tests__/fetchImpersonation.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5, plus `fetchWithAuth` from `../client`.
- Produces:
  - `loadOptions(now?: Date): Promise<FacultyOptions[]>`
  - `loadYear1Groups(p: ProgrammeOption): Promise<number[]>`
  - `fetchImpersonation(sel: ImpersonationSelection, now?: Date): Promise<ImpersonationResult>`
  - Throws `ImpersonationError` with codes `options` / `noPlan` / `noSemester` / `timetable`.

- [ ] **Step 1: Write the failing test**

The test routes `fetchWithAuth` by URL and body to the real fixtures.

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FX = 'src/api/impersonation/__tests__/fixtures/';
const raw = (n: string) => readFileSync(resolve(process.cwd(), FX + n), 'utf8');
const noResults = readFileSync(resolve(process.cwd(), 'src/api/__tests__/fixtures/is-rozvrh-no-results.html'), 'utf8');

const fetchWithAuth = vi.fn();
vi.mock('../../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

import { loadOptions, loadYear1Groups, fetchImpersonation } from '../fetchImpersonation';
import type { ImpersonationSelection } from '../types';

function route(url: string, init?: RequestInit): string {
  const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  if (url.includes('rozvrhy_view.pl?konf=1;lang=cz')) return raw('rozvrh-index.html');
  if (url.includes('rozvrhy_view.pl?konf=1;z=')) return raw('rozvrh-range.html');
  if (url.includes('rozvrhy_view.pl') && !body.has('format')) return raw('rozvrh-criteria.html');
  if (body.get('format') === 'list') return raw('rozvrh-list-bf-y1.html');
  if (body.get('format') === 'json' && body.get('predmet') === '164066')
    return raw(`rozvrh-predmet-ft.${body.get('lang')}.json`);
  if (body.get('format') === 'json' && body.get('skupina') === '2')
    return raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`);
  if (body.get('format') === 'json') return noResults;
  if (url.includes('plany.pl?fakulta=2;lang=cz')) return raw('catalog-periods-pef.html');
  if (url.includes('program=1889') && !url.includes('stud_plan')) return raw('catalog-programme-bf-801.html');
  if (url.includes('stud_plan=12490') && url.includes('lang=en')) return raw('catalog-plan-bf-801.en.html');
  if (url.includes('stud_plan=12490')) return raw('catalog-plan-bf-801.cz.html');
  throw new Error(`unrouted ${url}`);
}

beforeEach(() => {
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => new Response(route(url, init)));
});

const SEPT = new Date(2026, 8, 26);

describe('loadOptions', () => {
  it('lists prezenční programmes of the current rozvrhy, B-/N- only', async () => {
    const opts = await loadOptions(SEPT);
    const pef = opts.find((f) => f.faculty === 'PEF')!;
    const bf = pef.programmes.find((p) => p.shortCode === 'B-F')!;
    expect(bf).toMatchObject({ programId: '1889', name: 'Finance', years: [1, 2, 3] });
    expect(bf.rozvrh.id).toBe('5769');
    expect(opts.every((f) => f.programmes.every((p) => /^[BN]-/.test(p.shortCode)))).toBe(true);
  });
  it('fails as "options" when no validity range covers today', async () => {
    await expect(loadOptions(new Date(2027, 5, 1))).rejects.toMatchObject({ code: 'options' });
  });
});

describe('fetchImpersonation', () => {
  const base = async (): Promise<ImpersonationSelection> => {
    const bf = (await loadOptions(SEPT)).find((f) => f.faculty === 'PEF')!.programmes.find((p) => p.shortCode === 'B-F')!;
    return { programId: bf.programId, shortCode: bf.shortCode, name: bf.name, faculty: 'PEF', year: 2, group: null, rozvrh: bf.rozvrh, periodLabel: 'ZS 2026/2027' };
  };

  it('year 2: intake 801 plan, semester 3, per-subject first slots, both languages', async () => {
    const r = await fetchImpersonation(await base(), SEPT);
    expect(r.plan.cz.blocks).toHaveLength(6);
    expect(r.plan.en.blocks).toHaveLength(6);
    const enrolled = r.plan.cz.blocks[2]!.groups.flatMap((g) => g.subjects).filter((s) => s.isEnrolled);
    expect(enrolled.map((s) => s.code)).toContain('EBC-FT');
    // Only EBC-FT has a routed timetable; the rest answer no-results = no lessons, not failure.
    expect(new Set(r.schedule.map((l) => l.courseCode))).toEqual(new Set(['EBC-FT']));
    expect(r.schedule.every((l) => l.courseNameEn && l.studyId === '')).toBe(true);
    expect(Object.keys(r.subjects.data)).toContain('EBC-FT');
  });

  it('asks for groups only in the list format', async () => {
    const bf = (await base()).rozvrh;
    await expect(
      loadYear1Groups({ programId: '1889', shortCode: 'B-F', name: 'Finance', faculty: 'PEF', rozvrh: bf, years: [1, 2, 3] })
    ).resolves.toEqual([1, 2, 3, 4, 5]);
  });

  it('a failed timetable leg fails the whole fetch (never half-applied)', async () => {
    fetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      if (body.get('format') === 'json' && body.get('lang') === 'en') return new Response('<html>login</html>');
      return new Response(route(url, init));
    });
    await expect(fetchImpersonation(await base(), SEPT)).rejects.toMatchObject({ code: 'timetable' });
  });

  it('a year beyond the plan fails as noSemester', async () => {
    // Year 4 → intake ZS 2023/2024 (poc 734, present in the real period list);
    // the router answers the programme page with the 801 one, whose plan has no
    // semester 7.
    await expect(fetchImpersonation({ ...(await base()), year: 4 }, SEPT)).rejects.toMatchObject({
      code: 'noSemester',
    });
  });

  it('an intake the catalogue does not list fails as noPlan', async () => {
    await expect(fetchImpersonation({ ...(await base()), year: 40 }, SEPT)).rejects.toMatchObject({
      code: 'noPlan',
    });
  });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/api/impersonation/__tests__/fetchImpersonation.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

`src/api/impersonation/fetchImpersonation.ts`:

```ts
import { fetchWithAuth } from '../client';
import { mergeDualLanguageLessons } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import type { SubjectInfo } from '../../types/documents';
import {
  ImpersonationError, type FacultyOptions, type ImpersonationResult,
  type ImpersonationSelection, type ProgrammeOption,
} from './types';
import { parseDoc } from './text';
import { intakeLabel, targetSemester } from './intake';
import { parseRanges, pickCurrentRange, parseRozvrhRows, parseCriteria, parseGroupNumbers } from './timetableForm';
import { TIMETABLE_URL, criteriaBody, timetableBody, readTimetableAnswer, type TimetableFilter } from './timetableQuery';
import { CATALOG_URL, FACULTY_IDS, typStudiaFor, findPeriodPoc, programmeUrl, findLeafUrl } from './catalogNav';
import { parseCatalogPlan, subjectsToAttend, toStudyPlan, type CatalogRow } from './catalogPlan';
import { firstSlotOnly } from './pickSlots';

const text = async (url: string, init?: RequestInit) => (await fetchWithAuth(url, init)).text();
const post = (body: string) => text(TIMETABLE_URL, { method: 'POST', body });

/** Timetable POSTs are expensive for IS (reis-scraper keeps its crawl at 3). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    })
  );
  return out;
}

export async function loadOptions(now = new Date()): Promise<FacultyOptions[]> {
  const range = pickCurrentRange(parseRanges(parseDoc(await text(`${TIMETABLE_URL}?konf=1;lang=cz`))), now);
  if (!range) throw new ImpersonationError('options');
  const rozvrhy = parseRozvrhRows(
    parseDoc(await text(`${TIMETABLE_URL}?konf=1;z=${range.z};k=${range.k};lang=cz`)),
    range
  ).filter((r) => r.form === 'prezenční' && r.faculty in FACULTY_IDS);
  const byFaculty = new Map<string, ProgrammeOption[]>();
  for (const r of rozvrhy) {
    const form = parseCriteria(parseDoc(await post(criteriaBody(r))));
    const list = byFaculty.get(r.faculty) ?? [];
    for (const p of form.programmes) {
      if (!typStudiaFor(p.shortCode) || list.some((x) => x.programId === p.programId)) continue;
      list.push({ ...p, faculty: r.faculty, rozvrh: r, years: form.years });
    }
    byFaculty.set(r.faculty, list);
  }
  return [...byFaculty].map(([faculty, programmes]) => ({ faculty, programmes }));
}

export async function loadYear1Groups(p: ProgrammeOption): Promise<number[]> {
  const html = await post(timetableBody(p.rozvrh, { program: p.programId, rocnik: 1 }, 'cz', 'list'));
  return parseGroupNumbers(parseDoc(html), 1);
}

async function lessonsFor(sel: ImpersonationSelection, f: TimetableFilter, pickFirst: boolean) {
  const [cz, en] = await Promise.all(
    (['cz', 'en'] as const).map(async (lang) => readTimetableAnswer(await post(timetableBody(sel.rozvrh, f, lang, 'json'))))
  );
  if (cz!.kind === 'failed' || en!.kind === 'failed') throw new ImpersonationError('timetable');
  const czL = cz!.kind === 'lessons' ? cz!.lessons : [];
  const enL = en!.kind === 'lessons' ? en!.lessons : [];
  return mergeDualLanguageLessons(pickFirst ? firstSlotOnly(czL) : czL, enL);
}

export async function fetchImpersonation(sel: ImpersonationSelection, now = new Date()): Promise<ImpersonationResult> {
  const fakulta = FACULTY_IDS[sel.faculty];
  const typ = typStudiaFor(sel.shortCode);
  if (!fakulta || !typ) throw new ImpersonationError('noPlan');
  const poc = findPeriodPoc(parseDoc(await text(`${CATALOG_URL}?fakulta=${fakulta};lang=cz`)), intakeLabel(sel.year, now));
  if (!poc) throw new ImpersonationError('noPlan');
  const leaf = findLeafUrl(parseDoc(await text(programmeUrl(fakulta, poc, typ, sel.programId))));
  if (!leaf) throw new ImpersonationError('noPlan');
  const [czSems, enSems] = await Promise.all(
    [leaf, leaf.replace('lang=cz', 'lang=en')].map(async (u) => parseCatalogPlan(parseDoc(await text(u))))
  );
  const target = targetSemester(sel.year, now);
  const semester = czSems!.find((s) => s.number === target);
  if (!semester) throw new ImpersonationError('noSemester');
  const attend = subjectsToAttend(semester);

  let schedule: BlockLesson[];
  if (sel.year === 1) {
    schedule = await lessonsFor(sel, { program: sel.programId, rocnik: 1, skupina: sel.group ?? 0 }, false);
  } else {
    const withId = attend.filter((r): r is CatalogRow & { predmetId: string } => r.predmetId !== null);
    schedule = (await mapLimit(withId, 3, (r) => lessonsFor(sel, { predmet: r.predmetId }, true))).flat();
  }

  const title = `${sel.shortCode} ${sel.name} · ${intakeLabel(sel.year, now)}`;
  const enrolled = { semester: target, codes: new Set(attend.map((r) => r.code)) };
  const enNames = new Map(enSems!.flatMap((s) => s.groups.flatMap((g) => g.rows.map((r) => [r.code, r.name] as const))));
  const fetchedAt = new Date().toISOString();
  const data: Record<string, SubjectInfo> = {};
  for (const r of attend) {
    data[r.code] = {
      displayName: r.name, fullName: `${r.code} ${r.name}`, nameCs: r.name, nameEn: enNames.get(r.code) ?? r.name,
      subjectCode: r.code, ...(r.predmetId ? { subjectId: r.predmetId } : {}), folderUrl: '', fetchedAt,
    };
  }
  return {
    plan: { cz: toStudyPlan(czSems!, title, enrolled), en: toStudyPlan(enSems!, title, enrolled) },
    schedule,
    subjects: { version: 1, lastUpdated: fetchedAt, data },
    fetchedAt: Date.now(),
  };
}
```

This file is about 110 lines, under the 200 limit.

- [ ] **Step 4: Run the test and check that it passes**

Run: `npx vitest run src/api/impersonation && npm run typecheck`
Expected: PASS. If a case reports a different code, read which request the router threw on and fix the **router** so it answers as real IS would. A missing period row means `noPlan`; a plan without the target semester means `noSemester`.

- [ ] **Step 5: Commit**

```bash
git add src/api/impersonation/fetchImpersonation.ts src/api/impersonation/__tests__/fetchImpersonation.test.ts
git commit -m "feat(impersonation): fetch options, groups and a full plan+timetable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Overlay guard middleware

**Files:**
- Create: `src/store/overlay/overlayGuard.ts`
- Modify: `src/store/useAppStore.ts:52` (wrap the creator)
- Test: `src/store/overlay/__tests__/overlayGuard.test.ts`

**Interfaces:**
- Produces:
  - `OVERLAY_KEYS`
  - `overlayWrite<T extends object>(partial: T): T`
  - `overlayGuard(config: StateCreator<AppState, [], [], AppState>): StateCreator<AppState, [], [], AppState>`
- Relies on `AppState.impersonation`, which Task 8 adds. Until then, the guard reads it as `(get() as { impersonation?: unknown }).impersonation`.

- [ ] **Step 1: Write the failing test**

The test builds a tiny store with the guard, so it doesn't boot the app.

```ts
import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { overlayGuard, overlayWrite, OVERLAY_KEYS } from '../overlayGuard';

type S = { impersonation: object | null; schedule: { data: string[] }; theme: string; setSchedule: (d: string[]) => void };

const make = () =>
  create<S>()(
    overlayGuard(((set) => ({
      impersonation: null,
      schedule: { data: ['real'] },
      theme: 'light',
      setSchedule: (d: string[]) => set({ schedule: { data: d } }),
    })) as never) as never
  );

describe('overlayGuard', () => {
  it('passes every write through while no impersonation is active', () => {
    const s = make();
    s.getState().setSchedule(['a']);
    expect(s.getState().schedule.data).toEqual(['a']);
  });

  it('drops protected keys while impersonating, but keeps the rest of the write', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState({ schedule: { data: ['real sync'] }, theme: 'dark' });
    s.getState().setSchedule(['real again']);
    expect(s.getState().schedule.data).toEqual(['fin']);
    expect(s.getState().theme).toBe('dark');
  });

  it('lets an overlayWrite through and leaves no marker in state', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState(overlayWrite({ schedule: { data: ['fin2'] } }));
    expect(s.getState().schedule.data).toEqual(['fin2']);
    expect(Object.getOwnPropertySymbols(s.getState())).toEqual([]);
  });

  it('function updaters are guarded too', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState((st) => ({ schedule: { data: [...st.schedule.data, 'x'] } }));
    expect(s.getState().schedule.data).toEqual(['fin']);
  });

  it('protects every IS-derived domain the overlay replaces or blanks', () => {
    expect([...OVERLAY_KEYS].sort()).toEqual(
      ['cvicneTests', 'exams', 'gradeHistory', 'odevzdavarny', 'schedule', 'studyComparison', 'studyPlanDual', 'studyStats', 'subjects'].sort()
    );
  });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/store/overlay/__tests__/overlayGuard.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

`src/store/overlay/overlayGuard.ts`:

```ts
import type { StateCreator } from 'zustand';
import type { AppState } from '../types';

/**
 * The IS-derived domains an impersonation replaces (schedule, plan, subjects)
 * or blanks (the rest). While one is active, NO writer but the impersonation
 * slice may touch them — the real sync keeps writing IndexedDB underneath, and
 * exit re-reads it. Code-keyed stores (files, classmates, attendance,
 * syllabuses) are left alone: foreign codes are simply absent there.
 */
export const OVERLAY_KEYS = [
  'schedule', 'studyPlanDual', 'subjects', 'exams', 'studyStats',
  'studyComparison', 'gradeHistory', 'cvicneTests', 'odevzdavarny',
] as const satisfies readonly (keyof AppState)[];

const OVERLAY_WRITE = Symbol('overlayWrite');

/** Marks a partial as the impersonation slice's own write. */
export function overlayWrite<T extends object>(partial: T): T {
  return Object.assign({ [OVERLAY_WRITE]: true }, partial);
}

type Partialish = Record<string | symbol, unknown>;

/**
 * One choke point instead of a guard in every slice: every `set` and every
 * external `setState` passes through here. A slice added later is covered
 * without anyone remembering to add a check.
 */
export function overlayGuard(
  config: StateCreator<AppState, [], [], AppState>
): StateCreator<AppState, [], [], AppState> {
  return (set, get, api) => {
    const guarded = ((partial: unknown, replace?: boolean) => {
      const next = (typeof partial === 'function' ? (partial as (s: AppState) => unknown)(get()) : partial) as Partialish | null;
      if (!next || typeof next !== 'object') return set(next as never, replace as never);
      const marked = next[OVERLAY_WRITE] === true;
      const clean: Partialish = { ...next };
      delete clean[OVERLAY_WRITE];
      const active = (get() as { impersonation?: unknown }).impersonation != null;
      if (active && !marked) for (const k of OVERLAY_KEYS) delete clean[k];
      return set(clean as never, replace as never);
    }) as typeof set;
    api.setState = guarded;
    return config(guarded, get, api);
  };
}
```

In `src/store/useAppStore.ts`, add the import `import { overlayGuard } from './overlay/overlayGuard';`. Change `export const useAppStore = create<AppState>()((...a) => ({` to `export const useAppStore = create<AppState>()(overlayGuard((...a) => ({`, and the matching closing `}));` to `})));`.

- [ ] **Step 4: Run the tests plus a broad store test, and typecheck**

Run: `npx vitest run src/store && npm run typecheck`
Expected: PASS. Nothing is impersonating, so every existing store test behaves exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/store/overlay src/store/useAppStore.ts
git commit -m "feat(store): overlay guard — one choke point that shields IS-derived keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Impersonation slice, storage, boot restore, exit paths

**Files:**
- Create:
  - `src/store/overlay/overlayState.ts`
  - `src/store/slices/impersonation/impersonationStorage.ts`
  - `src/store/slices/createImpersonationSlice.ts`
- Modify:
  - `src/store/types.ts`: add `import('./slices/createImpersonationSlice').ImpersonationSlice &` to `AppState`, and `| { kind: 'impersonation' }` to `MobileSheet`
  - `src/store/useAppStore.ts`: `...createImpersonationSlice(...a),`, plus the restore wiring
  - `src/store/slices/createAdminSlice.ts`: the `adminLogout` exit
  - `src/store/slices/createDemoSlice.ts`: `IS_DERIVED_META_KEYS`
- Test: `src/store/slices/__tests__/createImpersonationSlice.test.ts`

**Interfaces:**
- Consumes: `fetchImpersonation`, `loadOptions`, `loadYear1Groups`, the types, `overlayWrite`, `currentPeriod`, `periodLabel`.
- Produces (the slice):
  - **State:**
    - `impersonation: ActiveImpersonation | null`
    - `impersonationPickerOpen: boolean`
    - `impersonationOptions: FacultyOptions[] | null`
    - `impersonationOptionsStatus: 'idle' | 'loading' | 'error'`
    - `impersonationGroups: Record<string, number[] | 'loading' | 'error'>`
    - `impersonationStarting: boolean`
    - `impersonationError: ImpersonationErrorCode | null`
  - **Actions:**
    - `openImpersonationPicker(): void`
    - `closeImpersonationPicker(): void`
    - `loadImpersonationOptions(): Promise<void>`
    - `loadImpersonationGroups(p: ProgrammeOption): Promise<void>`
    - `startImpersonation(req: Omit<ImpersonationSelection, 'periodLabel'>): Promise<boolean>`
    - `stopImpersonation(): Promise<void>`
    - `restoreImpersonation(): Promise<void>`
  - **Type:** `ActiveImpersonation { selection: ImpersonationSelection; result: ImpersonationResult }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchImpersonation = vi.fn();
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
  loadOptions: vi.fn(async () => []),
  loadYear1Groups: vi.fn(async () => [1, 2]),
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import type { ImpersonationResult, ImpersonationSelection } from '../../../api/impersonation/types';

const lesson = (code: string) => ({ id: code, date: '20260922', startTime: '09:00', endTime: '10:50', courseCode: code, courseName: code, courseId: '1', room: 'Q01', roomStructured: { name: 'Q01', id: '1' }, isSeminar: 'false', isConsultation: 'false', isDefaultCampus: 'true', facultyCode: 'PEF', campus: 'Brno', teachers: [], studyId: '', periodId: '' });
const RESULT: ImpersonationResult = {
  plan: { cz: { title: 'B-F', isFulfilled: false, creditsAcquired: 0, creditsRequired: 180, blocks: [] }, en: { title: 'B-F', isFulfilled: false, creditsAcquired: 0, creditsRequired: 180, blocks: [] } },
  schedule: [lesson('EBC-MT')],
  subjects: { version: 1, lastUpdated: 'x', data: {} },
  fetchedAt: 1,
};
const REQ: Omit<ImpersonationSelection, 'periodLabel'> = {
  programId: '1889', shortCode: 'B-F', name: 'Finance', faculty: 'PEF', year: 1, group: 2,
  rozvrh: { id: '5769', z: '20260921', k: '20261213', label: '', period: 'ZS 2026/2027', faculty: 'PEF', form: 'prezenční', start: '21.09.2026', end: '20.12.2026' },
};

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  await IndexedDBService.set('schedule', 'current', [lesson('REAL-1')] as never);
  // overlayWrite: a previous test may have left an impersonation active, and the
  // guard would otherwise strip this reset of `schedule`.
  useAppStore.setState(overlayWrite({ impersonation: null, adminRole: 'reis_admin', demoMode: false, schedule: { data: [lesson('REAL-1')] as never, status: 'success' as const } }));
  fetchImpersonation.mockResolvedValue(RESULT);
});

describe('impersonation slice', () => {
  it('refuses unless the signed-in admin is a reis_admin', async () => {
    useAppStore.setState({ adminRole: 'association' });
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(false);
    expect(useAppStore.getState().impersonationError).toBe('notAdmin');
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('applies the overlay, and real sync data arriving meanwhile cannot replace it', async () => {
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(true);
    expect(useAppStore.getState().schedule.data.map((l) => l.courseCode)).toEqual(['EBC-MT']);
    useAppStore.getState().setSchedule([lesson('REAL-2')] as never);
    await useAppStore.getState().fetchSchedule();
    expect(useAppStore.getState().schedule.data.map((l) => l.courseCode)).toEqual(['EBC-MT']);
    expect(useAppStore.getState().exams.data).toEqual([]);
    expect(useAppStore.getState().studyStats).toBeNull();
  });

  it('never writes the real stores; exit re-reads them', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    expect((await IndexedDBService.get('schedule', 'current'))!.map((l) => l.courseCode)).toEqual(['REAL-1']);
    await useAppStore.getState().stopImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(useAppStore.getState().schedule.data.map((l) => l.courseCode)).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('survives a restart: restore re-applies from IDB without calling IS', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null });
    fetchImpersonation.mockClear();
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation?.selection.shortCode).toBe('B-F');
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('restore drops it when the admin session is gone (admin logout, IS logout, identity change)', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null, adminRole: null });
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('restore drops a cache from another period and says so', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null });
    vi.setSystemTime(new Date(2027, 2, 1));
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(useAppStore.getState().impersonationError).toBe('expired');
  });

  it('adminLogout ends an active impersonation', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    await useAppStore.getState().adminLogout();
    expect(useAppStore.getState().impersonation).toBeNull();
  });

  it('a failed fetch leaves the real data and reports the code', async () => {
    const { ImpersonationError } = await import('../../../api/impersonation/types');
    fetchImpersonation.mockRejectedValue(new ImpersonationError('timetable'));
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(false);
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(useAppStore.getState().impersonationError).toBe('timetable');
    expect(useAppStore.getState().schedule.data.map((l) => l.courseCode)).toEqual(['REAL-1']);
  });
});
```

Before running it, check how other slice tests set up IndexedDB (e.g. `fake-indexeddb` in `src/test/setup*`) and match that. If `adminLogout` calls Supabase, mock `../../../services/admin/authClient` the same way `createAdminSlice` tests do. Search for them with `grep -rl "adminLogout" src/store/slices/__tests__`.

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/store/slices/__tests__/createImpersonationSlice.test.ts`
Expected: FAIL, because `startImpersonation` is not a function.

- [ ] **Step 3: Implement**

`src/store/overlay/overlayState.ts`:

```ts
import type { ImpersonationResult } from '../../api/impersonation/types';

/** What the screens show while impersonating: the fetched three, the rest empty. */
export function overlayState(result: ImpersonationResult) {
  return {
    schedule: { data: result.schedule, status: 'success' as const },
    studyPlanDual: result.plan,
    subjects: result.subjects,
    ...blankRest(),
  };
}

/** The protected keys reset to "nothing loaded" — the first step of exit. */
export function blankOverlayState() {
  return { schedule: { data: [], status: 'loading' as const }, studyPlanDual: null, subjects: null, ...blankRest() };
}

function blankRest() {
  return {
    exams: { data: [], status: 'success' as const, error: null },
    studyStats: null,
    studyComparison: null,
    gradeHistory: null,
    cvicneTests: [],
    odevzdavarny: [],
  };
}
```

`src/store/slices/impersonation/impersonationStorage.ts`:

```ts
import { IndexedDBService } from '../../../services/storage';
import type { ActiveImpersonation } from '../createImpersonationSlice';

const KEY = 'impersonation';

/** `meta` rejects `undefined` values (MetaSchema), so round-trip through JSON first. */
export async function saveImpersonation(a: ActiveImpersonation): Promise<void> {
  await IndexedDBService.set('meta', KEY, JSON.parse(JSON.stringify(a)));
}

export async function loadImpersonation(): Promise<ActiveImpersonation | null> {
  const v = (await IndexedDBService.get('meta', KEY)) as Partial<ActiveImpersonation> | undefined;
  return v?.selection && v.result && Array.isArray(v.result.schedule) ? (v as ActiveImpersonation) : null;
}

export async function clearImpersonation(): Promise<void> {
  await IndexedDBService.delete('meta', KEY);
}
```

`src/store/slices/createImpersonationSlice.ts`:

```ts
import type { AppSlice } from '../types';
import {
  ImpersonationError, type FacultyOptions, type ImpersonationErrorCode,
  type ImpersonationResult, type ImpersonationSelection, type ProgrammeOption,
} from '../../api/impersonation/types';
import { fetchImpersonation, loadOptions, loadYear1Groups } from '../../api/impersonation/fetchImpersonation';
import { currentPeriod, periodLabel } from '../../api/impersonation/intake';
import { overlayWrite } from '../overlay/overlayGuard';
import { overlayState, blankOverlayState } from '../overlay/overlayState';
import { saveImpersonation, loadImpersonation, clearImpersonation } from './impersonation/impersonationStorage';
import { logError } from '../../utils/reportError';

export interface ActiveImpersonation {
  selection: ImpersonationSelection;
  result: ImpersonationResult;
}

export interface ImpersonationSlice {
  impersonation: ActiveImpersonation | null;
  impersonationPickerOpen: boolean;
  impersonationOptions: FacultyOptions[] | null;
  impersonationOptionsStatus: 'idle' | 'loading' | 'error';
  impersonationGroups: Record<string, number[] | 'loading' | 'error'>;
  impersonationStarting: boolean;
  impersonationError: ImpersonationErrorCode | null;
  openImpersonationPicker: () => void;
  closeImpersonationPicker: () => void;
  loadImpersonationOptions: () => Promise<void>;
  loadImpersonationGroups: (p: ProgrammeOption) => Promise<void>;
  startImpersonation: (req: Omit<ImpersonationSelection, 'periodLabel'>) => Promise<boolean>;
  stopImpersonation: () => Promise<void>;
  restoreImpersonation: () => Promise<void>;
}

const codeOf = (e: unknown): ImpersonationErrorCode => (e instanceof ImpersonationError ? e.code : 'timetable');

export const createImpersonationSlice: AppSlice<ImpersonationSlice> = (set, get) => ({
  impersonation: null,
  impersonationPickerOpen: false,
  impersonationOptions: null,
  impersonationOptionsStatus: 'idle',
  impersonationGroups: {},
  impersonationStarting: false,
  impersonationError: null,

  openImpersonationPicker: () => {
    set({ impersonationPickerOpen: true });
    void get().loadImpersonationOptions();
  },
  closeImpersonationPicker: () => set({ impersonationPickerOpen: false }),

  // Called from the entry's click handler on both trees — never from an effect.
  loadImpersonationOptions: async () => {
    if (get().impersonationOptions || get().impersonationOptionsStatus === 'loading') return;
    set({ impersonationOptionsStatus: 'loading' });
    try {
      set({ impersonationOptions: await loadOptions(), impersonationOptionsStatus: 'idle' });
    } catch (e) {
      logError('Impersonation.loadOptions', e);
      set({ impersonationOptionsStatus: 'error' });
    }
  },

  loadImpersonationGroups: async (p) => {
    if (Array.isArray(get().impersonationGroups[p.programId])) return;
    set((s) => ({ impersonationGroups: { ...s.impersonationGroups, [p.programId]: 'loading' } }));
    try {
      const groups = await loadYear1Groups(p);
      set((s) => ({ impersonationGroups: { ...s.impersonationGroups, [p.programId]: groups } }));
    } catch (e) {
      logError('Impersonation.loadGroups', e);
      set((s) => ({ impersonationGroups: { ...s.impersonationGroups, [p.programId]: 'error' } }));
    }
  },

  startImpersonation: async (req) => {
    if (get().adminRole !== 'reis_admin' || get().demoMode) {
      set({ impersonationError: 'notAdmin' });
      return false;
    }
    set({ impersonationStarting: true, impersonationError: null });
    const selection: ImpersonationSelection = { ...req, periodLabel: periodLabel(currentPeriod(new Date())) };
    try {
      const result = await fetchImpersonation(selection);
      const active = { selection, result };
      await saveImpersonation(active);
      set(overlayWrite({ impersonation: active, ...overlayState(result), impersonationStarting: false, impersonationPickerOpen: false }));
      const codes = Object.keys(result.subjects.data);
      if (codes.length) void get().fetchSuccessRateBatch(codes).catch(() => {});
      return true;
    } catch (e) {
      logError('Impersonation.start', e, { year: req.year });
      set({ impersonationStarting: false, impersonationError: codeOf(e) });
      return false;
    }
  },

  stopImpersonation: async () => {
    await clearImpersonation().catch((e) => logError('Impersonation.clear', e));
    set(overlayWrite({ impersonation: null, ...blankOverlayState() }));
    const s = get();
    await Promise.all([
      s.fetchSchedule(), s.fetchStudyPlan(), s.fetchSubjects(), s.fetchExams(), s.fetchStudyStats(),
      s.fetchStudyComparison(), s.loadGradeHistory(), s.fetchCvicneTests(), s.fetchOdevzdavarny(),
    ]);
  },

  // Boot: after loadAdminSession. One check covers admin logout, IS logout and a
  // changed student — each of those leaves no reis_admin session behind.
  restoreImpersonation: async () => {
    const saved = await loadImpersonation().catch(() => null);
    if (!saved) return;
    const expired = saved.selection.periodLabel !== periodLabel(currentPeriod(new Date()));
    if (get().adminRole !== 'reis_admin' || expired) {
      await clearImpersonation().catch(() => {});
      if (expired) set({ impersonationError: 'expired' });
      return;
    }
    set(overlayWrite({ impersonation: saved, ...overlayState(saved.result) }));
  },
});
```

This file is about 130 lines.

Wiring:

- **`src/store/types.ts`:** add `import('./slices/createImpersonationSlice').ImpersonationSlice &` before `DemoSlice;` in `AppState`, and `| { kind: 'impersonation' }` to `MobileSheet`.
- **`src/store/useAppStore.ts`:**
  - Add the import and `...createImpersonationSlice(...a),` after `...createDemoSlice(...a),`.
  - Replace `s.loadAdminSession();` with:

    ```ts
    void s.loadAdminSession().then(() => useAppStore.getState().restoreImpersonation());
    ```

  - In the dev-seed branch, after `useAppStore.setState({...})`, add `void s.restoreImpersonation();`.
- **`src/store/slices/createAdminSlice.ts`:** make the first line of `adminLogout`:

  ```ts
  if (get().impersonation) await get().stopImpersonation();
  ```

- **`src/store/slices/createDemoSlice.ts`:** change `IS_DERIVED_META_KEYS` to `['study_stats', 'study_comparison', 'impersonation'] as const`.

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx vitest run src/store && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat(impersonation): overlay slice with restart restore and exit paths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Desktop UI: picker, drawer, entry, banner, strings

**Files:**
- Create:
  - `src/components/Impersonation/ImpersonationPicker.tsx`
  - `src/components/Impersonation/ImpersonationDrawer.tsx`
  - `src/components/Impersonation/ImpersonationBanner.tsx`
- Modify:
  - `src/components/AppOverlays.tsx`: mount the drawer
  - `src/App.tsx`: floating banner in the desktop return, as the last child of the root `div`
  - `src/components/Sidebar/ProfilePopup.tsx`: the entry, in the Services section after `SpolkySection`
  - `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/Impersonation/__tests__/ImpersonationBanner.test.tsx`, `src/components/Impersonation/__tests__/ImpersonationPicker.test.tsx`

- [ ] **Step 1: Add the strings**

Add a top-level `"impersonation"` block to `cs.json`:

```json
"impersonation": {
  "entry": "Zobrazit jako student…",
  "entrySub": "Plán a rozvrh jiného oboru",
  "title": "Zobrazit jako student",
  "faculty": "Fakulta",
  "programme": "Obor",
  "year": "Ročník",
  "yearN": "{n}. ročník",
  "group": "Studijní skupina",
  "groupN": "{n}. skupina",
  "groupAll": "Všechny skupiny",
  "groupsLoading": "Načítám skupiny…",
  "start": "Zobrazit",
  "loading": "Načítám obory z IS…",
  "scopeNote": "Jen prezenční studium se zimním nástupem. Od 2. ročníku rozvrh bere první paralelku každého předmětu.",
  "errorOptions": "IS nevrátil seznam oborů.",
  "errorTimetable": "IS nevrátil rozvrh.",
  "errorNoPlan": "Pro tento obor a ročník IS nemá studijní plán.",
  "errorNoSemester": "Plán tohoto oboru nemá semestr pro zvolený ročník.",
  "errorNotAdmin": "Jen pro správce reIS.",
  "expired": "Zobrazení jako student skončilo s koncem semestru.",
  "bannerLabel": "Zobrazuješ jako {programme} · {year}. ročník",
  "bannerExit": "Ukončit"
}
```

Add the same keys to `en.json`:

```json
"impersonation": {
  "entry": "View as a student…",
  "entrySub": "Another programme's plan and timetable",
  "title": "View as a student",
  "faculty": "Faculty",
  "programme": "Programme",
  "year": "Year",
  "yearN": "Year {n}",
  "group": "Study group",
  "groupN": "Group {n}",
  "groupAll": "All groups",
  "groupsLoading": "Loading groups…",
  "start": "View",
  "loading": "Loading programmes from IS…",
  "scopeNote": "Full-time programmes with a winter intake only. From year 2 on, the timetable takes each subject's first parallel.",
  "errorOptions": "IS did not return the programme list.",
  "errorTimetable": "IS did not return the timetable.",
  "errorNoPlan": "IS has no study plan for this programme and year.",
  "errorNoSemester": "This programme's plan has no semester for that year.",
  "errorNotAdmin": "reIS admins only.",
  "expired": "Viewing as a student ended with the semester.",
  "bannerLabel": "Viewing as {programme} · year {year}",
  "bannerExit": "Exit"
}
```

- [ ] **Step 2: Write the failing component tests**

`src/components/Impersonation/__tests__/ImpersonationBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';
import { ImpersonationBanner } from '../ImpersonationBanner';

const active = {
  selection: { programId: '1889', shortCode: 'B-F', name: 'Finance', faculty: 'PEF', year: 1, group: 2, periodLabel: 'ZS 2026/2027', rozvrh: {} as never },
  result: { plan: {} as never, schedule: [], subjects: { version: 1, lastUpdated: '', data: {} }, fetchedAt: 0 },
};

beforeEach(() => useAppStore.setState(overlayWrite({ impersonation: null, language: 'cz' })));

describe('ImpersonationBanner', () => {
  it('renders nothing when not impersonating', () => {
    const { container } = render(<ImpersonationBanner variant="floating" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('names programme, year and group, and exits on click', () => {
    const stop = vi.fn(async () => {});
    useAppStore.setState(overlayWrite({ impersonation: active, stopImpersonation: stop }));
    render(<ImpersonationBanner variant="row" />);
    expect(screen.getByText(/B-F · 1\. ročník/)).toBeInTheDocument();
    expect(screen.getByText(/2\. skupina/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ukončit' }));
    expect(stop).toHaveBeenCalledOnce();
  });
});
```

`src/components/Impersonation/__tests__/ImpersonationPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ImpersonationPicker } from '../ImpersonationPicker';

const rozvrh = { id: '5769', z: '1', k: '2', label: '', period: '', faculty: 'PEF', form: 'prezenční', start: '', end: '' };
const bf = { programId: '1889', shortCode: 'B-F', name: 'Finance', faculty: 'PEF', rozvrh, years: [1, 2, 3] };

beforeEach(() =>
  useAppStore.setState({
    language: 'cz', impersonationOptions: [{ faculty: 'PEF', programmes: [bf] }],
    impersonationOptionsStatus: 'idle', impersonationGroups: { '1889': [1, 2] },
    impersonationStarting: false, impersonationError: null,
  })
);

describe('ImpersonationPicker', () => {
  it('asks for groups on picking a programme and starts with the full selection', () => {
    const start = vi.fn(async () => true);
    const loadGroups = vi.fn(async () => {});
    useAppStore.setState({ startImpersonation: start, loadImpersonationGroups: loadGroups });
    render(<ImpersonationPicker />);
    fireEvent.change(screen.getByLabelText('Fakulta'), { target: { value: 'PEF' } });
    fireEvent.change(screen.getByLabelText('Obor'), { target: { value: '1889' } });
    expect(loadGroups).toHaveBeenCalledWith(bf);
    fireEvent.change(screen.getByLabelText('Studijní skupina'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit' }));
    expect(start).toHaveBeenCalledWith({ programId: '1889', shortCode: 'B-F', name: 'Finance', faculty: 'PEF', year: 1, group: 2, rozvrh });
  });
  it('hides the group select from year 2', () => {
    render(<ImpersonationPicker />);
    fireEvent.change(screen.getByLabelText('Fakulta'), { target: { value: 'PEF' } });
    fireEvent.change(screen.getByLabelText('Obor'), { target: { value: '1889' } });
    fireEvent.change(screen.getByLabelText('Ročník'), { target: { value: '2' } });
    expect(screen.queryByLabelText('Studijní skupina')).toBeNull();
  });
});
```

- [ ] **Step 3: Run them and check that they fail**

Run: `npx vitest run src/components/Impersonation`
Expected: FAIL, unresolved imports.

- [ ] **Step 4: Implement**

`src/components/Impersonation/ImpersonationBanner.tsx`:

```tsx
import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';

/**
 * Not dismissible, on both trees: an admin must never mistake another
 * programme's timetable for their own. `row` sits above the phone's screens and
 * carries --safe-top itself (like DemoBanner); `floating` overlays the desktop.
 */
export function ImpersonationBanner({ variant }: { variant: 'row' | 'floating' }) {
  const { t } = useTranslation();
  const active = useAppStore((s) => s.impersonation);
  const stop = useAppStore((s) => s.stopImpersonation);
  const [pending, setPending] = useState(false);
  if (!active) return null;
  const { selection } = active;
  const exit = async () => {
    if (pending) return;
    setPending(true);
    try {
      await stop();
    } catch (e) {
      logError('ImpersonationBanner.exit', e);
    } finally {
      setPending(false);
    }
  };
  const cls =
    variant === 'row'
      ? 'flex flex-shrink-0 items-center justify-center gap-3 bg-info/20 px-4 pb-1 pt-[calc(0.25rem_+_var(--safe-top,0px))] text-xs text-base-content'
      : 'fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-info/40 bg-base-100 px-4 py-1 text-xs text-base-content shadow';
  return (
    <div className={cls} role="status">
      <UserCog size={14} className="flex-shrink-0 text-info" />
      <span className="font-semibold">
        {t('impersonation.bannerLabel', { programme: selection.shortCode, year: selection.year })}
        {selection.group !== null && ` · ${t('impersonation.groupN', { n: selection.group })}`}
      </span>
      <button className="btn btn-ghost btn-xs" onClick={() => void exit()} disabled={pending}>
        {pending ? <span className="loading loading-spinner loading-xs" /> : t('impersonation.bannerExit')}
      </button>
    </div>
  );
}
```

`src/components/Impersonation/ImpersonationPicker.tsx`:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { ImpersonationErrorCode } from '../../api/impersonation/types';

const ERROR_KEY: Record<ImpersonationErrorCode, string> = {
  options: 'impersonation.errorOptions',
  timetable: 'impersonation.errorTimetable',
  noPlan: 'impersonation.errorNoPlan',
  noSemester: 'impersonation.errorNoSemester',
  notAdmin: 'impersonation.errorNotAdmin',
  expired: 'impersonation.expired',
};

/** Shared by the desktop drawer and the phone sheet. `onStarted` closes the sheet. */
export function ImpersonationPicker({ onStarted }: { onStarted?: () => void }) {
  const { t } = useTranslation();
  const options = useAppStore((s) => s.impersonationOptions);
  const status = useAppStore((s) => s.impersonationOptionsStatus);
  const groupsById = useAppStore((s) => s.impersonationGroups);
  const starting = useAppStore((s) => s.impersonationStarting);
  const error = useAppStore((s) => s.impersonationError);
  const loadGroups = useAppStore((s) => s.loadImpersonationGroups);
  const start = useAppStore((s) => s.startImpersonation);
  const [faculty, setFaculty] = useState('');
  const [programId, setProgramId] = useState('');
  const [year, setYear] = useState(1);
  const [group, setGroup] = useState<number | null>(null);

  if (status === 'loading' || (!options && status !== 'error'))
    return <p className="p-4 text-sm text-base-content/70">{t('impersonation.loading')}</p>;

  const programmes = options?.find((f) => f.faculty === faculty)?.programmes ?? [];
  const programme = programmes.find((p) => p.programId === programId);
  const groups = programme ? groupsById[programme.programId] : undefined;

  const pickProgramme = (id: string) => {
    setProgramId(id);
    setYear(1);
    setGroup(null);
    const p = programmes.find((x) => x.programId === id);
    if (p) void loadGroups(p);
  };
  const submit = async () => {
    if (!programme) return;
    const { programId: pid, shortCode, name, rozvrh } = programme;
    const ok = await start({ programId: pid, shortCode, name, faculty, year, group: year === 1 ? group : null, rozvrh });
    if (ok) onStarted?.();
  };
  const field = 'select select-bordered select-sm w-full';

  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1 text-xs text-base-content/70">
        {t('impersonation.faculty')}
        <select className={field} value={faculty} onChange={(e) => { setFaculty(e.target.value); setProgramId(''); }}>
          <option value="" disabled>—</option>
          {options?.map((f) => <option key={f.faculty} value={f.faculty}>{f.faculty}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-base-content/70">
        {t('impersonation.programme')}
        <select className={field} value={programId} disabled={!faculty} onChange={(e) => pickProgramme(e.target.value)}>
          <option value="" disabled>—</option>
          {programmes.map((p) => <option key={p.programId} value={p.programId}>{`${p.shortCode} ${p.name}`}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-base-content/70">
        {t('impersonation.year')}
        <select className={field} value={year} disabled={!programme} onChange={(e) => setYear(Number(e.target.value))}>
          {(programme?.years ?? [1]).map((y) => <option key={y} value={y}>{t('impersonation.yearN', { n: y })}</option>)}
        </select>
      </label>
      {year === 1 && programme && (
        <label className="flex flex-col gap-1 text-xs text-base-content/70">
          {t('impersonation.group')}
          <select className={field} value={group ?? ''} disabled={!Array.isArray(groups)} onChange={(e) => setGroup(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{groups === 'loading' ? t('impersonation.groupsLoading') : t('impersonation.groupAll')}</option>
            {Array.isArray(groups) && groups.map((g) => <option key={g} value={g}>{t('impersonation.groupN', { n: g })}</option>)}
          </select>
        </label>
      )}
      <p className="text-xs text-base-content/70">{t('impersonation.scopeNote')}</p>
      {(error || status === 'error') && (
        <p className="text-xs text-error">{t(ERROR_KEY[error ?? 'options'])}</p>
      )}
      <button className="btn btn-primary btn-sm" disabled={!programme || starting} onClick={() => void submit()}>
        {starting ? <span className="loading loading-spinner loading-xs" /> : t('impersonation.start')}
      </button>
    </div>
  );
}
```

This file is about 100 lines. The error `<p>` uses `text-error` as ink on the base surface, matching the other drawers. `verify-ui` checks its contrast in Task 11.

`src/components/Impersonation/ImpersonationDrawer.tsx`:

```tsx
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { ImpersonationPicker } from './ImpersonationPicker';

/** Desktop wrapper. The phone tree uses ImpersonationSheet around the same picker. */
export function ImpersonationDrawer() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.impersonationPickerOpen);
  const close = useAppStore((s) => s.closeImpersonationPicker);
  return (
    <AdaptiveDrawer open={open} onClose={close} width="sm:w-[420px]" title={t('impersonation.title')}>
      <div className="flex items-center gap-3 border-b border-base-300 px-4 pb-3 pt-4">
        <h2 className="flex-1 text-base font-bold">{t('impersonation.title')}</h2>
        <button className="btn btn-ghost btn-sm btn-square" onClick={close} aria-label="close">
          <X size={16} />
        </button>
      </div>
      <ImpersonationPicker />
    </AdaptiveDrawer>
  );
}
```

Mounts:

- **`src/components/AppOverlays.tsx`:** import `ImpersonationDrawer` and add `<ImpersonationDrawer />` after `<DocumentsDrawer />`.
- **`src/App.tsx`:** import `ImpersonationBanner` and add `<ImpersonationBanner variant="floating" />` right after `<AppOverlays … />` inside the desktop root `div`.
- **`src/components/Sidebar/ProfilePopup.tsx`:** add `UserCog` to the lucide import, and add these at the top of the component:

  ```ts
  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  const openImpersonationPicker = useAppStore((s) => s.openImpersonationPicker);
  ```

  Inside the Services section `div`, after `<SpolkySection … />`, add:

  ```tsx
  {isReisAdmin && (
    <button
      onClick={() => {
        openImpersonationPicker();
        onClose?.();
      }}
      className="w-full flex items-center gap-2 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors"
    >
      <UserCog size={16} className="text-base-content/50" />
      <span className="text-xs opacity-70">{t('impersonation.entry')}</span>
    </button>
  )}
  ```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run src/components/Impersonation && npm run typecheck`
Expected: PASS. `ProfilePopup.tsx` stays under 200 lines; check with `wc -l`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Impersonation src/components/AppOverlays.tsx src/App.tsx src/components/Sidebar/ProfilePopup.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(impersonation): desktop picker, profile entry and banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Phone/iPad UI: sheet, entry, banner row

**Files:**
- Create: `src/components/mobile/sheets/ImpersonationSheet.tsx`
- Modify:
  - `src/components/mobile/sheets/SheetHost.tsx`
  - `src/components/mobile/screens/ProfileScreen.tsx`
  - `src/components/mobile/MobileApp.tsx`
- Test: `src/components/mobile/screens/__tests__/ProfileScreen.impersonation.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../../store/useAppStore';
import { ProfileScreen } from '../ProfileScreen';

beforeEach(() => useAppStore.setState({ language: 'cz', mobileSheets: [] }));

describe('ProfileScreen impersonation entry', () => {
  it('is absent for everyone but a reis_admin', () => {
    useAppStore.setState({ adminRole: 'association' });
    render(<ProfileScreen />);
    expect(screen.queryByText('Zobrazit jako student…')).toBeNull();
  });
  it('for a reis_admin, opens the sheet and asks for the options', () => {
    const load = vi.fn(async () => {});
    useAppStore.setState({ adminRole: 'reis_admin', loadImpersonationOptions: load });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Zobrazit jako student…'));
    expect(load).toHaveBeenCalledOnce();
    expect(useAppStore.getState().mobileSheets.map((s) => s.kind)).toContain('impersonation');
  });
});
```

If `ProfileScreen` needs providers or mocks to render (photo fetch, `useSpolkySettings`), copy the setup from an existing `ProfileScreen` test. Find it with `grep -rl "ProfileScreen" src/components/mobile --include=*.test.tsx`.

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/components/mobile/screens/__tests__/ProfileScreen.impersonation.test.tsx`
Expected: FAIL, because the text isn't found.

- [ ] **Step 3: Implement**

`src/components/mobile/sheets/ImpersonationSheet.tsx`:

```tsx
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { ImpersonationPicker } from '../../Impersonation/ImpersonationPicker';

/** Phone/iPad wrapper around the picker the desktop drawer also renders. */
export function ImpersonationSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('impersonation.title')} onClose={onClose} />
      <ImpersonationPicker onStarted={onClose} />
    </Sheet>
  );
}
```

- **`SheetHost.tsx`:** import it, and add before `default:`:

  ```tsx
  case 'impersonation':
    return <ImpersonationSheet key={index} onClose={popSheet} />;
  ```

- **`ProfileScreen.tsx`:** add `UserCog` to its lucide import. Add these selectors:

  ```ts
  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  const loadImpersonationOptions = useAppStore((s) => s.loadImpersonationOptions);
  ```

  After the Dokumenty `NavRow`, add:

  ```tsx
  {isReisAdmin && (
    <NavRow
      icon={UserCog}
      label={t('impersonation.entry')}
      sublabel={t('impersonation.entrySub')}
      onClick={() => {
        void loadImpersonationOptions();
        pushSheet({ kind: 'impersonation' });
      }}
    />
  )}
  ```

  If the file then passes 200 lines, move `AboutSection`'s neighbour block or the header block into its own component file, following the existing `profile/` folder pattern.
- **`MobileApp.tsx`:**
  - Import `ImpersonationBanner`, and add `const impersonating = useAppStore((s) => s.impersonation !== null);`.
  - Define `const topBanner = demoMode || impersonating;`.
  - Use it in `toastOffset(topBanner)` and in the safe-top shadow (`${topBanner ? ' [--safe-top:0px]' : ''}`).
  - Add `<ImpersonationBanner variant="row" />` directly after `<DemoBanner />`.
  - Extend the existing comment on the safe-top wrapper with one sentence: "ImpersonationBanner takes the same top strip, so it counts too."

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/components/mobile src/components/Impersonation && npm run typecheck`
Expected: PASS, and the existing MobileApp/ProfileScreen tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile
git commit -m "feat(impersonation): phone/iPad sheet, profile entry and banner row

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verification: UI at every width, live IS, PR

**Files:** none new, unless verification finds a defect. Fix it in the task that owns the file, test first.

- [ ] **Step 1: Full impersonation test set plus typecheck**

Run: `npx vitest run src/api/impersonation src/store src/components/Impersonation src/components/mobile src/api/__tests__/schedule* && npm run typecheck`
Expected: all PASS. Report the counts.

- [ ] **Step 2: Tree parity self-check**

- **Extension:** entry in ProfilePopup, drawer in AppOverlays, floating banner in App.
- **Phone:** entry in ProfileScreen, sheet in SheetHost, banner row in MobileApp.
- **Tablet:** the same phone tree. Verified in the next step.

No guard file is needed, because nothing diverges.

- [ ] **Step 3: `verify-ui` skill**

Invoke the `verify-ui` skill. Seed an active impersonation in the dev webapp (`npm run dev:web:reis-admin`, via `window` store handle `setState(overlayWrite(...))` with the Task 8 test's `RESULT`, or a real start if IS is reachable). Screenshot the following at 320/390/430 and at tablet width, in both themes, with overflow, collision and contrast assertions:

- the phone ProfileScreen with the entry visible
- the ImpersonationSheet
- the calendar with the banner row
- the desktop profile popup
- the drawer
- the desktop calendar with the floating banner, checked for collisions with the week header

Send the before/after PNGs to Dominik with SendUserFile, unasked (memory: verifying-ui-work).

- [ ] **Step 4: Live check against real IS (the tests cannot prove this)**

On the dev webapp signed in as reis_admin (`npm run dev:web:reis-admin` plus an IS session):

1. Impersonate PEF · B-F · year 1 · group 2. Expect the timetable to match the probe: Tue 07:00 EBC-PE Q01, Tue 09:00 EBC-MT Q01, Mon 09:00 EBC-DS seminar Q48, and so on. Expect the plan to show 6 semesters with semester 1 marked enrolled.
2. Impersonate B-F · year 2. Expect semester 3 subjects with one lecture and one seminar slot each. Record how many IS requests went out.
3. Reload. Impersonation must persist without new IS timetable requests.
4. Click Ukončit. The real timetable and plan must return.

Then on the iPad (memory: ipad-device), build and install the real release build and repeat step 1. Report each step as observed, with screenshots.

- [ ] **Step 5: Privacy disclosure check**

Run `git diff origin/test --stat -- privacy/`. If the `disclosure-drift` hook asks, the answer is: no new outbound flow. The data goes IS → device over the admin's own session, the same as the existing syllabus/plan fetches. Add nothing to `privacy/disclosures.ts` unless its test fails.

- [ ] **Step 6: Push and open the PR against `test`**

Follow the github-push-identity memory for the push identity, then:

```bash
gh pr create --base test --title "feat: admin student impersonation (plan + timetable, live from IS)" --body "<summary of spec + verification evidence>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Right after creation, enable Auto-fix (memory: always-enable-auto-fix), bind the PR with the ccd_pr tools, and don't merge. The feature stays parked as a PR (memory: park-features-as-prs-not-in-test).
