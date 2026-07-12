# Localhost Real-Data Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the reIS iframe app at localhost with the developer's real (possibly stale) IS Mendelu data, by reusing the extension's own `src/api/*` code in Node to produce a `SyncedData` snapshot the localhost app auto-ingests.

**Architecture:** A tsx CLI (`scripts/scrape-real-data.ts`) logs into IS with Playwright, captures cookies, installs Node shims (happy-dom for `DOMParser`, `fake-indexeddb` for IDB, a cookie-injecting `fetch`), then runs `collectRealData()` — a standalone mirror of `syncAllData` that calls the unchanged `src/api/*` fetchers/parsers and assembles a `SyncedData`. It writes `public/.dev-real-data.json` (gitignored). In dev, standalone (not in an iframe), `useAppLogic` auto-fetches that file and dispatches a synthetic `REIS_SYNC_UPDATE` through the production ingest handler.

**Tech Stack:** TypeScript, tsx, Playwright, happy-dom, fake-indexeddb, Vitest, WXT/Vite, React 19, Zustand.

## Global Constraints

- Max 200 lines per file — split proactively (project convention).
- Direct imports only — no re-export barrels.
- NO `localStorage`/`sessionStorage` — use `IndexedDBService`.
- **Never modify a parser** (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/utils/parsers/*`) to satisfy lint/tests. This plan reuses parsers; it must not edit them.
- Test first (TDD): failing test before implementation.
- Snapshot file `public/.dev-real-data.json` holds real personal data — must be gitignored, never committed, never transmitted.
- Auth: developer supplies `MENDELU_USER`/`MENDELU_PASS` in `.env`; the tool never logs credential values. Claude never enters the credentials.
- Login endpoint: `https://is.mendelu.cz/system/login.pl`, form fields `credential_0` (user), `credential_1` (pass).
- `SyncedData` type and `Messages` factory imported from `@/types/messages`.

---

### Task 1: Cookie-injecting fetch factory + Node runtime shims

**Files:**
- Create: `scripts/lib/nodeRuntime.ts`
- Test: `scripts/lib/__tests__/nodeRuntime.test.ts`

**Interfaces:**
- Produces: `createCookieFetch(cookieHeader: string, baseFetch?: typeof fetch): typeof fetch` — returns a fetch that adds `Cookie: <cookieHeader>` to requests whose URL host is `is.mendelu.cz`, and passes all other requests through unchanged.
- Produces: `installNodeRuntime(cookieHeader: string): void` — imperative glue that (1) imports `fake-indexeddb/auto`, (2) creates a happy-dom `Window` and assigns `globalThis.window`, `globalThis.document`, `globalThis.DOMParser` from it, and (3) sets `globalThis.fetch = createCookieFetch(cookieHeader, nativeFetch)`. Must be called before importing any `@/api/*` module.

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/lib/__tests__/nodeRuntime.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createCookieFetch } from '../nodeRuntime';

describe('createCookieFetch', () => {
  it('adds the Cookie header for is.mendelu.cz requests', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz');
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(new Headers(init.headers).get('Cookie')).toBe('ISSESSID=abc');
  });

  it('does NOT add cookies for other hosts', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://example.com/');
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] ?? {};
    expect(new Headers(init.headers ?? {}).get('Cookie')).toBeNull();
  });

  it('preserves caller-supplied headers', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://is.mendelu.cz/x', { headers: { 'accept-language': 'cs' } });
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const h = new Headers(init.headers);
    expect(h.get('accept-language')).toBe('cs');
    expect(h.get('Cookie')).toBe('ISSESSID=abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/nodeRuntime.test.ts`
Expected: FAIL — "Failed to resolve import '../nodeRuntime'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/lib/nodeRuntime.ts
import { Window } from 'happy-dom';

const IS_HOST = 'is.mendelu.cz';

/** Returns a fetch that injects the Cookie header for is.mendelu.cz requests. */
export function createCookieFetch(
  cookieHeader: string,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      host = '';
    }
    if (host !== IS_HOST) return baseFetch(input, init);
    const headers = new Headers(init.headers);
    headers.set('Cookie', cookieHeader);
    return baseFetch(input, { ...init, headers });
  }) as typeof fetch;
}

/** Install DOM + IndexedDB + cookie-fetch globals so src/api/* runs in Node.
 *  MUST run before importing any @/api/* module. */
export async function installNodeRuntime(cookieHeader: string): Promise<void> {
  await import('fake-indexeddb/auto');
  const nativeFetch = globalThis.fetch;
  const win = new Window({ url: 'https://is.mendelu.cz/' });
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = win.document;
  g.DOMParser = win.DOMParser;
  g.fetch = createCookieFetch(cookieHeader, nativeFetch);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/nodeRuntime.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nodeRuntime.ts scripts/lib/__tests__/nodeRuntime.test.ts
git commit -m "feat(scraper): node runtime shims + cookie-injecting fetch"
```

---

### Task 2: collectRealData orchestration (standalone mirror of syncAllData)

**Files:**
- Create: `scripts/lib/collectRealData.ts`
- Test: `scripts/lib/__tests__/collectRealData.test.ts`

**Interfaces:**
- Consumes: unchanged `@/api/*` fetchers and `@/services/sync/*` helpers (same imports `src/injector/syncService.ts` uses).
- Produces: `collectRealData(): Promise<SyncedData>` — logs progress to stderr, tolerates per-endpoint failures via `Promise.allSettled`, returns an assembled `SyncedData` (no `sendToIframe`, no Drive backup).

- [ ] **Step 1: Write the failing test** (orchestration test — mocks the api modules; parser behavior is covered by the api modules' own existing tests)

```typescript
// scripts/lib/__tests__/collectRealData.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/userParams', () => ({
  getUserParams: vi.fn(async () => ({ studium: 'S1', obdobi: 'O1' })),
}));
vi.mock('@/injector/dataFetchers', () => ({
  fetchFullSemesterSchedule: vi.fn(async () => [{ id: 'lesson1' }]),
}));
vi.mock('@/api/exams', () => ({ fetchDualLanguageExams: vi.fn(async () => [{ code: 'X' }]) }));
vi.mock('@/api/subjects', () => ({
  fetchDualLanguageSubjects: vi.fn(async () => ({
    subjects: { data: {} }, attendance: {}, availablePeriods: [],
  })),
}));
vi.mock('@/api/pastSubjects', () => ({ fetchDualLanguagePastSubjects: vi.fn(async () => null) }));
vi.mock('@/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn(async () => null) }));
vi.mock('@/api/studyStats', () => ({ fetchStudyStats: vi.fn(async () => null) }));
vi.mock('@/api/studyComparison', () => ({ fetchStudyComparison: vi.fn(async () => null) }));
vi.mock('@/services/sync/syncCvicneTests', () => ({ syncCvicneTests: vi.fn(async () => null) }));
vi.mock('@/services/sync/syncOdevzdavarny', () => ({ syncOdevzdavarny: vi.fn(async () => null) }));
vi.mock('@/services/sync/mergePastSubjects', () => ({ mergePastSubjects: vi.fn() }));

import { collectRealData } from '../collectRealData';

describe('collectRealData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assembles schedule/exams/subjects into SyncedData', async () => {
    const data = await collectRealData();
    expect(data.schedule).toEqual([{ id: 'lesson1' }]);
    expect(data.exams).toEqual([{ code: 'X' }]);
    expect(data.subjects).toEqual({ data: {} });
    expect(typeof data.lastSync).toBe('number');
  });

  it('tolerates a failing endpoint (exams rejects) and still returns data', async () => {
    const { fetchDualLanguageExams } = await import('@/api/exams');
    (fetchDualLanguageExams as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const data = await collectRealData();
    expect(data.schedule).toEqual([{ id: 'lesson1' }]);
    expect(data.exams).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/collectRealData.test.ts`
Expected: FAIL — "Failed to resolve import '../collectRealData'".

- [ ] **Step 3: Write minimal implementation** (mirror of `src/injector/syncService.ts` `syncAllData`, minus side effects; the per-subject files/syllabus/zaznamnik/classmates phase mirrors `syncSubjectDetails`)

```typescript
// scripts/lib/collectRealData.ts
import pLimit from 'p-limit';
import type { SyncedData } from '@/types/messages';
import { getUserParams } from '@/utils/userParams';
import { fetchFullSemesterSchedule } from '@/injector/dataFetchers';
import { fetchDualLanguageExams } from '@/api/exams';
import { fetchDualLanguageSubjects } from '@/api/subjects';
import { fetchDualLanguagePastSubjects } from '@/api/pastSubjects';
import { fetchDualLanguageStudyPlan } from '@/api/studyPlan';
import { fetchStudyStats } from '@/api/studyStats';
import { fetchStudyComparison } from '@/api/studyComparison';
import { syncCvicneTests } from '@/services/sync/syncCvicneTests';
import { syncOdevzdavarny } from '@/services/sync/syncOdevzdavarny';
import { mergePastSubjects } from '@/services/sync/mergePastSubjects';
import { fetchFilesFromFolder } from '@/api/documents';
import { fetchSyllabus } from '@/api/syllabus';
import { syncZaznamnik } from '@/services/sync/syncZaznamnik';
import { fetchSeminarGroupIds, fetchClassmates } from '@/api/classmates';

const limit = pLimit(3);
const log = (m: string) => process.stderr.write(`[collect] ${m}\n`);
const val = <T>(r: PromiseSettledResult<T>): T | undefined =>
  r.status === 'fulfilled' ? r.value : undefined;

export async function collectRealData(): Promise<SyncedData> {
  const params = await getUserParams();
  const studium = params?.studium;
  const obdobi = params?.obdobi;
  log(`userParams studium=${studium} obdobi=${obdobi}`);

  const [schedule, exams, subjectsRes, studyPlan, studyStats, studyComparison,
    cvicne, odev, pastSubjects] = await Promise.allSettled([
    fetchFullSemesterSchedule(),
    fetchDualLanguageExams(),
    fetchDualLanguageSubjects(studium || undefined, obdobi || undefined),
    studium ? fetchDualLanguageStudyPlan(studium) : Promise.resolve(null),
    studium && obdobi ? fetchStudyStats(studium, obdobi) : Promise.resolve(null),
    studium && obdobi ? fetchStudyComparison(studium, obdobi) : Promise.resolve(null),
    studium ? syncCvicneTests(studium) : Promise.resolve(null),
    studium && obdobi ? syncOdevzdavarny(studium, obdobi) : Promise.resolve(null),
    fetchDualLanguagePastSubjects(),
  ]);

  const subjects = val(subjectsRes) ?? null;
  const past = val(pastSubjects);
  if (subjects && past) {
    mergePastSubjects(subjects.subjects, past, val(studyPlan) ?? null);
  }

  const data: SyncedData = {
    schedule: val(schedule) ?? undefined,
    exams: (() => { const e = val(exams); return e && e.length ? e : undefined; })(),
    subjects: subjects?.subjects,
    attendance: subjects?.attendance as Record<string, unknown> | undefined,
    studyPlan: val(studyPlan) ?? undefined,
    studyStats: val(studyStats) ?? undefined,
    studyComparison: val(studyComparison) ?? undefined,
    cvicneTests: val(cvicne)?.tests,
    odevzdavarny: val(odev)?.assignments,
    files: {},
    syllabuses: {},
    lastSync: Date.now(),
  };

  if (subjects) {
    await collectSubjectDetails(data, subjects.subjects, studium, obdobi);
  }
  data.lastSync = Date.now();
  return data;
}

async function collectSubjectDetails(
  data: SyncedData,
  subjectsValue: { data: Record<string, { folderUrl?: string; subjectId?: string; skupinaId?: string; hasPrubezne?: boolean; hasTest?: boolean }> },
  studium?: string,
  obdobi?: string
): Promise<void> {
  const entries = Object.entries(subjectsValue.data);
  const files = data.files as Record<string, unknown>;
  const syllabuses = data.syllabuses as Record<string, unknown>;

  const tasks = entries.map(([code, s]) =>
    limit(async () => {
      const jobs: Promise<void>[] = [];
      if (s.folderUrl) jobs.push(fetchFilesFromFolder(s.folderUrl).then((f) => { files[code] = f; }).catch(() => {}));
      if (s.subjectId) jobs.push(fetchSyllabus(s.subjectId).then((y) => { syllabuses[code] = y; }).catch(() => {}));
      await Promise.all(jobs);
    })
  );

  const zaznamnik = studium && obdobi
    ? syncZaznamnik(studium, obdobi, entries.map(([courseCode, s]) => ({
        courseCode, subjectId: s.subjectId ?? '', hasPrubezne: s.hasPrubezne, hasTest: s.hasTest,
      }))).then((z) => { data.zaznamnik = z; }).catch(() => {})
    : Promise.resolve();

  await Promise.all([...tasks, zaznamnik]);

  if (!studium || !obdobi) return;
  try {
    const predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
    const classmates: Record<string, unknown> = {};
    const cmTasks = entries
      .filter(([, s]) => s.subjectId && predmetIdMap[s.subjectId])
      .map(([courseCode, s]) => limit(async () => {
        const skupinaId = predmetIdMap[s.subjectId!]!;
        try {
          classmates[courseCode] = await fetchClassmates(s.subjectId!, studium, obdobi, skupinaId);
        } catch { /* per-subject classmate failure is non-fatal */ }
      }));
    await Promise.all(cmTasks);
    data.classmates = classmates;
  } catch { /* group-map failure is non-fatal */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/collectRealData.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck the new files**

Run: `npm run typecheck`
Expected: no new errors. If `val(cvicne)?.tests` / `val(odev)?.assignments` mismatch the real return types, adjust the property access to match `syncCvicneTests`/`syncOdevzdavarny` return shapes (confirm with `grep -n "return" src/services/sync/syncCvicneTests.ts src/services/sync/syncOdevzdavarny.ts`).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/collectRealData.ts scripts/lib/__tests__/collectRealData.test.ts
git commit -m "feat(scraper): collectRealData orchestration mirroring syncAllData"
```

---

### Task 3: Playwright login CLI + npm script + gitignore

**Files:**
- Create: `scripts/scrape-real-data.ts`
- Modify: `package.json` (add `scrape:real` script)
- Modify: `.gitignore` (ignore snapshot)
- Modify: `.env.example` (document `MENDELU_USER`/`MENDELU_PASS`)

**Interfaces:**
- Consumes: `installNodeRuntime` (Task 1), `collectRealData` (Task 2).
- Produces: on success writes `public/.dev-real-data.json` and prints the path + row counts.

- [ ] **Step 1: Add the gitignore entry**

Append to `.gitignore`:

```
# Local real-data snapshot for localhost dev (real personal data — never commit)
public/.dev-real-data.json
```

- [ ] **Step 2: Document env keys in .env.example**

Append to `.env.example`:

```
# IS Mendelu credentials for scripts/scrape-real-data.ts (localhost real-data dev)
MENDELU_USER=your_is_username
MENDELU_PASS=your_is_password
```

- [ ] **Step 3: Write the CLI**

```typescript
// scripts/scrape-real-data.ts
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { installNodeRuntime } from './lib/nodeRuntime';

const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';
const OUT = resolve(process.cwd(), 'public/.dev-real-data.json');
const verbose = process.argv.includes('--verbose');

async function login(): Promise<string> {
  const user = process.env.MENDELU_USER;
  const pass = process.env.MENDELU_PASS;
  if (!user || !pass) {
    throw new Error('Missing MENDELU_USER / MENDELU_PASS in .env');
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="credential_0"]', user);
    await page.fill('input[name="credential_1"]', pass);
    await Promise.all([
      page.waitForURL('**/auth/**', { timeout: 30_000 }).catch(() => page.waitForLoadState('networkidle')),
      page.press('input[name="credential_1"]', 'Enter'),
    ]);
    const cookies = await context.cookies('https://is.mendelu.cz');
    if (!cookies.length) throw new Error('Login produced no cookies — check credentials');
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } finally {
    await browser.close();
  }
}

async function main() {
  process.stderr.write('[scrape] logging in…\n');
  const cookieHeader = await login();
  process.stderr.write('[scrape] session acquired, collecting data…\n');
  await installNodeRuntime(cookieHeader);
  const { collectRealData } = await import('./lib/collectRealData');
  const data = await collectRealData();
  mkdirSync(resolve(process.cwd(), 'public'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  const counts = {
    schedule: Array.isArray(data.schedule) ? data.schedule.length : 0,
    exams: Array.isArray(data.exams) ? data.exams.length : 0,
    subjects: data.subjects && typeof data.subjects === 'object'
      ? Object.keys((data.subjects as { data?: object }).data ?? {}).length : 0,
    files: Object.keys((data.files as object) ?? {}).length,
  };
  process.stdout.write(`\n✅ Wrote ${OUT}\n   ${JSON.stringify(counts)}\n`);
  process.stdout.write('   Now run: npm run dev  →  open http://localhost:3000/main.html\n');
  if (verbose) process.stdout.write(`\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n`);
}

main().catch((e) => {
  process.stderr.write(`\n❌ scrape:real failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
```

- [ ] **Step 4: Add the npm script**

In `package.json` `scripts`, add:

```json
"scrape:real": "tsx scripts/scrape-real-data.ts",
```

Verify `tsx` resolves (it is used by reis-scraper; if not present here, `npm i -D tsx` first — check with `npx tsx --version`).

- [ ] **Step 5: Smoke-check the CLI wiring without live login**

Run: `npx tsx scripts/scrape-real-data.ts` with an empty `.env`.
Expected: exits non-zero with "Missing MENDELU_USER / MENDELU_PASS in .env" — proves the script loads and fails cleanly.

- [ ] **Step 6: Commit**

```bash
git add scripts/scrape-real-data.ts package.json .gitignore .env.example
git commit -m "feat(scraper): scrape:real CLI (Playwright login → snapshot)"
```

---

### Task 4: Localhost auto-ingest wiring

**Files:**
- Create: `src/utils/loadRealDataSnapshot.ts`
- Test: `src/utils/__tests__/loadRealDataSnapshot.test.ts`
- Modify: `src/hooks/useAppLogic.ts` (import + call the loader; relax the standalone guard)

**Interfaces:**
- Produces: `loadRealDataSnapshot(): Promise<boolean>` — in dev + standalone (`!isInIframe()`) + not mock mode, fetches `/.dev-real-data.json`; if present, dispatches `window.postMessage(Messages.syncUpdate({ ...snapshot, isSyncing: false }), '*')` and resolves `true`; otherwise resolves `false`. No-throw.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/__tests__/loadRealDataSnapshot.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRealDataSnapshot } from '../loadRealDataSnapshot';

describe('loadRealDataSnapshot', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('posts a REIS_SYNC_UPDATE with the snapshot when the file exists', async () => {
    const snapshot = { schedule: [{ id: 'l1' }], lastSync: 123 };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 })));
    const posts: unknown[] = [];
    const spy = vi.spyOn(window, 'postMessage').mockImplementation(((m: unknown) => { posts.push(m); }) as typeof window.postMessage);

    const ok = await loadRealDataSnapshot();

    expect(ok).toBe(true);
    expect(posts[0]).toMatchObject({ type: 'REIS_SYNC_UPDATE', data: { schedule: [{ id: 'l1' }], isSyncing: false } });
    spy.mockRestore();
  });

  it('returns false and does not post when the file is absent (404)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const spy = vi.spyOn(window, 'postMessage');
    const ok = await loadRealDataSnapshot();
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/loadRealDataSnapshot.test.ts`
Expected: FAIL — "Failed to resolve import '../loadRealDataSnapshot'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/loadRealDataSnapshot.ts
import { Messages } from '../types/messages';
import { isInIframe } from '../api/proxyClient';
import type { SyncedData } from '../types/messages';

const SNAPSHOT_URL = '/.dev-real-data.json';

/** Dev-only, standalone-only: load the scraped real-data snapshot and feed it
 *  through the production REIS_SYNC_UPDATE handler. No-op if unavailable. */
export async function loadRealDataSnapshot(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  if (isInIframe()) return false;
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return false;
  try {
    const res = await fetch(SNAPSHOT_URL);
    if (!res.ok) return false;
    const snapshot = (await res.json()) as SyncedData;
    window.postMessage(Messages.syncUpdate({ ...snapshot, isSyncing: false }), '*');
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/loadRealDataSnapshot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the loader into useAppLogic and relax the standalone guard**

In `src/hooks/useAppLogic.ts`:

Add import near the other imports:

```typescript
import { loadRealDataSnapshot } from '../utils/loadRealDataSnapshot';
```

In the message effect (currently starting at line ~124), change the two guards so the handler runs at top level under the real-data path. Replace:

```typescript
    // Skip iframe data sync when using mock data
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return;

    if (!isInIframe()) return;
```

with:

```typescript
    // Skip iframe data sync when using mock data
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return;

    // Dev standalone (localhost): allow the real-data snapshot to flow through
    // the same handler by not bailing on the missing iframe.
    const realDataMode = import.meta.env.DEV && !isInIframe();
    if (!isInIframe() && !realDataMode) return;
```

At the end of that effect, replace:

```typescript
    window.addEventListener('message', handle);
    signalReady();
    requestData('all');
    return () => window.removeEventListener('message', handle);
```

with:

```typescript
    window.addEventListener('message', handle);
    if (realDataMode) {
      void loadRealDataSnapshot();
    } else {
      signalReady();
      requestData('all');
    }
    return () => window.removeEventListener('message', handle);
```

- [ ] **Step 6: Verify the handler accepts the synthetic message shape**

The handler's `isContentMessage(d)` gate validates against `ContentToIframeSchema`. Confirm a `Messages.syncUpdate(...)` object passes:

Run: `npx vitest run src/utils/__tests__/loadRealDataSnapshot.test.ts src/types/messages.test.ts 2>/dev/null || npx vitest run src/utils/__tests__/loadRealDataSnapshot.test.ts`
Then add this assertion to `loadRealDataSnapshot.test.ts` and re-run:

```typescript
  it('produces a message that passes isContentMessage', async () => {
    const { isContentMessage } = await import('../../types/messages');
    const msg = (await import('../../types/messages')).Messages.syncUpdate({ lastSync: 1, isSyncing: false });
    expect(isContentMessage(msg)).toBe(true);
  });
```

Expected: PASS. If it fails, the schema requires additional fields — inspect `ContentToIframeSchema` in `src/types/messages` and include the minimal required fields in the loader's message.

- [ ] **Step 7: Run the full unit suite + typecheck**

Run: `npm run test:run && npm run typecheck`
Expected: PASS, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/utils/loadRealDataSnapshot.ts src/utils/__tests__/loadRealDataSnapshot.test.ts src/hooks/useAppLogic.ts
git commit -m "feat(dev): auto-ingest real-data snapshot on localhost"
```

---

### Task 5: Anti-drift guard test (single parser codebase)

**Files:**
- Test: `scripts/lib/__tests__/no-parser-reimpl.test.ts`

**Interfaces:**
- Consumes: the source text of `scripts/lib/collectRealData.ts`.
- Produces: a CI-enforced invariant that the scraper contains no parser reimplementation and pulls all IS data extraction from `@/api/*` / `@/services/sync/*`.

- [ ] **Step 1: Write the test**

```typescript
// scripts/lib/__tests__/no-parser-reimpl.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../collectRealData.ts'), 'utf8');

describe('scraper reuses the extension parsers (no drift)', () => {
  it('does not reimplement HTML parsing in the scraper', () => {
    expect(SRC).not.toMatch(/new DOMParser/);
    expect(SRC).not.toMatch(/parseFromString/);
    expect(SRC).not.toMatch(/\.querySelector/);
  });

  it('imports all IS data extraction from the extension api/services layer', () => {
    // Every IS fetcher used must come from @/api/* or @/services/sync/* or @/injector/dataFetchers.
    const importLines = SRC.split('\n').filter((l) => /^import .* from ['"]@\//.test(l));
    const nonSharedImport = importLines.find(
      (l) => !/from ['"]@\/(api|services\/sync|injector\/dataFetchers|utils\/userParams|types\/messages)/.test(l)
    );
    expect(nonSharedImport, `unexpected import: ${nonSharedImport}`).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/no-parser-reimpl.test.ts`
Expected: PASS (2 tests). (If it fails because `collectRealData.ts` legitimately needs another shared module, widen the allow-list regex to include that `@/...` path — never widen it to a scraper-local parser.)

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/__tests__/no-parser-reimpl.test.ts
git commit -m "test(scraper): guard against parser reimplementation drift"
```

---

### Task 6: Live end-to-end run + verify the UI renders real data

**Files:** none (verification task). Requires real `MENDELU_USER`/`MENDELU_PASS` in `.env` — the developer supplies these.

- [ ] **Step 1: Ensure Playwright's Chromium is installed**

Run: `npx playwright install chromium`
Expected: Chromium present (project already uses Playwright for E2E).

- [ ] **Step 2: Run the scraper**

Run: `npm run scrape:real`
Expected: prints `✅ Wrote …/public/.dev-real-data.json` with non-zero `schedule`/`subjects` counts. If it fails at login, re-check `.env`; if a single endpoint errors, the run still writes partial data (by design).

- [ ] **Step 3: Confirm the snapshot exists and is gitignored**

Run: `ls -la public/.dev-real-data.json && git check-ignore public/.dev-real-data.json`
Expected: file exists; `git check-ignore` echoes the path (confirming it is ignored).

- [ ] **Step 4: Start the dev server**

Start `wxt-dev-chrome` (via the preview tool or `npm run dev`). Wait for `✔ Built extension`.

- [ ] **Step 5: Open the app and verify real data renders**

Open `http://localhost:3000/main.html` in the in-app browser. Verify the calendar/schedule view shows real lessons (not skeletons, not mock society data). Spot-check one subject drawer for real files.
Expected: real data visible with no manual steps or console errors related to ingest.

- [ ] **Step 6: Final full verification**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: all green.

- [ ] **Step 7: Update CLAUDE.md dev-surface note (optional, small)**

Add a one-line pointer under the dev/architecture docs: “Localhost real data: `npm run scrape:real` then `npm run dev` → `http://localhost:3000/main.html` (auto-ingests `public/.dev-real-data.json`).” Commit:

```bash
git add CLAUDE.md
git commit -m "docs: note localhost real-data dev flow"
```

---

## Self-Review

**Spec coverage:**
- §1 key insight (4 shims) → Task 1 (`installNodeRuntime`). ✓
- §2 components 1–2 (CLI, nodeRuntime) → Tasks 1, 3; component 3 (collectRealData) → Task 2; component 4 (ingest) → Task 4; components 5–6 (script, gitignore) → Task 3. ✓
- §3 data flow (login → shims → mirror → write) → Tasks 2, 3. ✓
- §4 ingest (dev + standalone + not-mock; synthetic REIS_SYNC_UPDATE) → Task 4. ✓
- §5 turnkey UX (scripts, URL) → Task 3 (script + printed URL), Task 6 (verify). ✓
- §6 anti-drift: guarantee 1 (structural) → Task 5; guarantee 2 (shared parser behavior) → covered by existing api parser tests + Task 2 orchestration test + Task 5 module-identity assertion; guarantee 3 (shape) → Task 4 loader test + `isContentMessage` assertion. ✓
- §7 error handling → Task 3 (login failure exit, allSettled tolerance, `--verbose`). ✓
- §8 privacy → Task 3 (gitignore) + Task 6 Step 3 (verify ignored). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `collectRealData(): Promise<SyncedData>` used consistently in Tasks 2, 3. `loadRealDataSnapshot(): Promise<boolean>` used consistently in Task 4. `createCookieFetch`/`installNodeRuntime` signatures match between Task 1 and Task 3 usage. `SyncedData`/`Messages` imported from `@/types/messages` throughout. ✓

**Known verification points flagged inline:** Task 2 Step 5 (confirm `syncCvicneTests`/`syncOdevzdavarny` return shapes), Task 4 Step 6 (confirm `ContentToIframeSchema` accepts the synthetic message). These are runtime-confirmable checks, not placeholders.
