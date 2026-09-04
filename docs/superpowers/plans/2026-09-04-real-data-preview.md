# Real-Data Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the reIS app against Dominik's own scraped IS Mendelu data on a second, login-gated Vercel project, deployed by one command from his laptop, with other students' identities removed before anything is uploaded.

**Architecture:** A sanitiser turns the raw scrape into `public/preview-data.json` — a different filename, so the unconditional strip of `dev-real-data.json` never needs a flag. A new build mode loads that file through the app's existing snapshot path while keeping demo mode's offline guards on. The existing public demo preview is untouched.

**Tech Stack:** Vite 7, React, Vitest (happy-dom), Playwright (scrape only), Vercel CLI 54.

Spec: [`docs/superpowers/specs/2026-09-04-real-data-preview-design.md`](../specs/2026-09-04-real-data-preview-design.md)

## Global Constraints

- **The strip of `dev-real-data.json` is unconditional and gains no flag.** `scripts/stripDevRealData.mjs` and its wiring test are not to be modified. The only file that may ship is `preview-data.json`, and only after passing the sanitiser.
- **No MENDELU credential goes into the repository, CI, or any workflow.** The scrape runs only from a laptop reading `.env`. No task adds a GitHub secret or a workflow that could read one.
- **The sanitiser fails closed.** An unrecognised field inside a classmate entry aborts, it does not pass through.
- **Only these `VITE_*` may be set on the new Vercel project:** `VITE_DEV_SOCIETY=reis`, `VITE_PREVIEW_BUILD=true`, `VITE_PREVIEW_DATA=real`. The allowlist in `scripts/assert-web-build-env.mjs` must be extended for the third or the build refuses. The `VITE_VERCEL_` prefix stays allowed.
- **No `localStorage`/`sessionStorage`**, no custom CSS (Tailwind/DaisyUI only), no re-export barrel files, no `useEffect` for data fetching, max 200 lines per file.
- **Never modify an IS Mendelu HTML parser** (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/utils/parsers/`). Suppress a lint rule instead.
- **Test first:** a failing test before implementation.
- Branch: `feat/real-data-preview`, already cut from `test`. `test` now requires a PR — do not push to it directly.
- Push with `git push personal HEAD`. `origin` is an Enterprise Managed User account and gets 403 on this repo.
- **Never run `npm install`/`npm ci`** — `node_modules` is a symlink to the main checkout.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/harnessEnabled.ts` (moved from `dev/`) | The harness predicate. Moves into `src/` because `src/services/loadRealDataSnapshot.ts` needs it and `src/` must never import from `dev/`. |
| `src/services/loadRealDataSnapshot.ts` (modify) | Guards widened so the loader is alive in a preview build; snapshot URL becomes a parameter. |
| `scripts/sanitiseSnapshot.ts` (new) | Pure function: strips other students' identities, fails closed on unknown fields. |
| `scripts/sanitise-snapshot.mjs` (new) | Thin CLI wrapper: reads the raw scrape, writes `public/preview-data.json`. |
| `dev/bootDemoMode.ts` (modify) | Branches on `VITE_PREVIEW_DATA=real` to load the snapshot instead of the demo dataset. |
| `dev/snapshotAge.ts` (new) | Renders the snapshot's `lastSync` date on the real-data build only. |
| `scripts/assert-web-build-env.mjs` (modify) | `VITE_PREVIEW_DATA` added to the allowlist. |
| `package.json` (modify) | `sanitise:snapshot`, `build:web:real`, `preview:real`. |
| `.gitignore` (modify) | `public/preview-data.json`. |

---

### Task 1: Wake the snapshot loader up in a preview build

`loadRealDataSnapshot()` opens with `if (!import.meta.env.DEV) return false;` (`src/services/loadRealDataSnapshot.ts:60`), and `resetRealDataStores()` does the same at `:40`. `DEV` is false in a production build, so both are dead code on any deployed page. Nothing else in this plan works until this does.

`src/` must not import from `dev/`, so the predicate moves into `src/utils/` first. This mirrors `src/utils/resolveDevPhoneOverride.ts`, which already lives there for the same reason.

**Files:**
- Create: `src/utils/harnessEnabled.ts` (moved content)
- Delete: `dev/harnessEnabled.ts`
- Modify: `dev/earlyDemoMode.ts`, `dev/phoneOverride.ts`, `dev/bootDemoMode.ts` (import paths)
- Move: `dev/__tests__/harnessEnabled.test.ts` → `src/utils/__tests__/harnessEnabled.test.ts`
- Modify: `src/services/loadRealDataSnapshot.ts:10,39-40,59-62`
- Create: `src/services/__tests__/loadRealDataSnapshot.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isHarnessEnabled(env)` and `isPreviewBuild(env)` and `interface HarnessEnv` from `src/utils/harnessEnabled.ts`; `loadRealDataSnapshot(url?: string): Promise<boolean>` and `resetRealDataStores(url?: string): Promise<boolean>` from `src/services/loadRealDataSnapshot.ts`.

- [ ] **Step 1: Move the predicate**

```bash
git mv dev/harnessEnabled.ts src/utils/harnessEnabled.ts
git mv dev/__tests__/harnessEnabled.test.ts src/utils/__tests__/harnessEnabled.test.ts
```

Fix the import inside the moved test — it becomes `from '../harnessEnabled'` (unchanged, since both moved together; confirm by running it).

In `dev/earlyDemoMode.ts`, `dev/phoneOverride.ts` and `dev/bootDemoMode.ts`, change `from './harnessEnabled'` to `from '../src/utils/harnessEnabled'`.

Add this note to the top of `src/utils/harnessEnabled.ts`, above the existing docblock:

```ts
// Lives in src/, not dev/, because src/services/loadRealDataSnapshot.ts needs
// it and src/ must never import from dev/ — the extension and Capacitor builds
// do not include dev/ at all. Same reason resolveDevPhoneOverride.ts sits here.
```

- [ ] **Step 2: Verify the move is clean**

Run: `npx vitest run src/utils/__tests__/harnessEnabled.test.ts && npx tsc -b`
Expected: 4 tests pass, typecheck clean, no unresolved imports.

- [ ] **Step 3: Write the failing test for the widened guard**

Create `src/services/__tests__/loadRealDataSnapshot.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../api/proxyClient', () => ({ isInIframe: () => false }));

describe('loadRealDataSnapshot', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PREVIEW_BUILD', 'true');
    vi.stubEnv('VITE_USE_MOCK_DATA', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
  });

  // The bug this test exists for: the loader was gated on import.meta.env.DEV,
  // which is FALSE in a production build, so on the deployed preview it
  // returned false without ever fetching anything.
  it('runs in a preview build even though DEV is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ schedule: [], lastSync: '2026-09-04T00:00:00.000Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot } = await import('../loadRealDataSnapshot');
    await expect(loadRealDataSnapshot()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches the URL it is given, not the default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot } = await import('../loadRealDataSnapshot');
    await loadRealDataSnapshot('/preview-data.json');
    expect(fetchMock).toHaveBeenCalledWith('/preview-data.json');
  });

  it('stays inert in an extension or Capacitor build', async () => {
    vi.stubEnv('VITE_PREVIEW_BUILD', '');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { loadRealDataSnapshot } = await import('../loadRealDataSnapshot');
    await expect(loadRealDataSnapshot()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/services/__tests__/loadRealDataSnapshot.test.ts`
Expected: FAIL — the first test resolves `false` and `fetchMock` is never called, because the `DEV` guard still short-circuits.

- [ ] **Step 5: Widen the guards and parameterise the URL**

In `src/services/loadRealDataSnapshot.ts`, add the import beneath the existing ones:

```ts
import { isHarnessEnabled } from '../utils/harnessEnabled';
```

Replace the comment above `SNAPSHOT_URL` (currently ends "and DEV-gated below so it is inert in production") with:

```ts
// Non-dotfile so WXT packs it into the dev build; the extension page fetches it
// from its own origin (chrome-extension://<id>/dev-real-data.json). Gitignored.
// The default for the local `dev:web` harness only — the deployed preview
// passes `/preview-data.json` instead, which is the SANITISED file. The raw
// scrape is deleted from every web build by scripts/stripDevRealData.mjs and
// must never be fetched from a deployed page.
```

In `resetRealDataStores`, replace `if (!import.meta.env.DEV) return false;` with:

```ts
  if (!isHarnessEnabled(import.meta.env)) return false;
```

and change its signature to accept the same URL:

```ts
export async function resetRealDataStores(url: string = SNAPSHOT_URL): Promise<boolean> {
```

updating its `fetch(SNAPSHOT_URL)` call to `fetch(url)`.

In `loadRealDataSnapshot`, make the same two changes:

```ts
export async function loadRealDataSnapshot(url: string = SNAPSHOT_URL): Promise<boolean> {
  if (!isHarnessEnabled(import.meta.env)) return false;
```

and its `fetch(SNAPSHOT_URL)` call becomes `fetch(url)`.

Leave the `isInIframe()` and `VITE_USE_MOCK_DATA` guards exactly as they are.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/services/__tests__/loadRealDataSnapshot.test.ts src/utils/ dev/`
Expected: PASS. `dev/__tests__/storeHandle.test.ts` is a known unrelated flake — ignore only that one.

- [ ] **Step 7: Confirm nothing leaked into the shipped extension**

```bash
npm run build
grep -rl "preview-data.json" .output/chrome-mv3/ || echo "not in the extension bundle"
```
Expected: `not in the extension bundle`.

- [ ] **Step 8: Commit**

```bash
git add -A src/utils src/services dev
git commit -m "$(cat <<'EOF'
fix(dev): wake the snapshot loader up in a preview build

loadRealDataSnapshot and resetRealDataStores were gated on import.meta.env.DEV,
which is false in a production build — so on a deployed page both returned
without fetching anything. Same trap phoneOverride had.

The predicate moves from dev/ to src/utils/ because src/ must never import from
dev/, and the snapshot URL becomes a parameter so the deployed build can fetch
the sanitised file while the local harness keeps reading the raw one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The sanitiser

`classmates` is **an object keyed by subject code** — 7 groups in the current snapshot — each value an array of entries. Every entry has exactly five fields: `messageUrl`, `name`, `personId`, `photoUrl`, `studyInfo`. Four of those five identify a real student.

**Files:**
- Create: `scripts/sanitiseSnapshot.ts`
- Create: `scripts/__tests__/sanitiseSnapshot.test.ts`
- Create: `scripts/sanitise-snapshot.mjs`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `sanitiseSnapshot(raw: unknown): { data: Record<string, unknown>; report: string[] }` from `scripts/sanitiseSnapshot.ts`, and the npm script `sanitise:snapshot`.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/sanitiseSnapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitiseSnapshot } from '../sanitiseSnapshot';

// Shape copied from the real snapshot; every value here is invented.
const raw = {
  lastSync: '2026-09-04T09:00:00.000Z',
  schedule: [{ date: '20260904' }],
  classmates: {
    'EXC-KPSIT': [
      {
        name: 'Novakova Jana, Bc.',
        personId: 100904,
        photoUrl: 'https://is.mendelu.cz/auth/lide/foto.pl?id=100904;lang=cz',
        messageUrl: '/auth/posta/nova_zprava.pl?uzivatel=100904',
        studyInfo: 'PEF N-OI-ZNUR prez [sem 3, roc 2]',
      },
      {
        name: 'Dvorak Petr',
        personId: 100905,
        photoUrl: 'https://is.mendelu.cz/auth/lide/foto.pl?id=100905;lang=cz',
        messageUrl: '/auth/posta/nova_zprava.pl?uzivatel=100905',
        studyInfo: 'PEF B-EM prez [sem 1, roc 1]',
      },
    ],
    'EBC-M': [],
  },
};

describe('sanitiseSnapshot', () => {
  it('keeps every group and every row', () => {
    const { data } = sanitiseSnapshot(raw);
    const c = data.classmates as Record<string, unknown[]>;
    expect(Object.keys(c).sort()).toEqual(['EBC-M', 'EXC-KPSIT']);
    expect(c['EXC-KPSIT']).toHaveLength(2);
    expect(c['EBC-M']).toHaveLength(0);
  });

  // Each of these re-identifies the person the fake name was meant to protect:
  // photoUrl and messageUrl both embed the personId.
  it('removes every identifying field', () => {
    const { data } = sanitiseSnapshot(raw);
    const first = (data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!;
    expect(first).not.toHaveProperty('personId');
    expect(first).not.toHaveProperty('photoUrl');
    expect(first).not.toHaveProperty('messageUrl');
  });

  it('replaces the real name and keeps studyInfo', () => {
    const { data } = sanitiseSnapshot(raw);
    const first = (data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!;
    expect(first.name).not.toBe('Novakova Jana, Bc.');
    expect(typeof first.name).toBe('string');
    expect((first.name as string).length).toBeGreaterThan(0);
    expect(first.studyInfo).toBe('PEF N-OI-ZNUR prez [sem 3, roc 2]');
  });

  // Stable output keeps a diff of two snapshots readable.
  it('generates the same name for the same row twice', () => {
    const first = (out: ReturnType<typeof sanitiseSnapshot>) =>
      (out.data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!.name;
    expect(first(sanitiseSnapshot(raw))).toBe(first(sanitiseSnapshot(raw)));
  });

  it('leaves the owner-s own data untouched', () => {
    const { data } = sanitiseSnapshot(raw);
    expect(data.schedule).toEqual(raw.schedule);
    expect(data.lastSync).toBe(raw.lastSync);
  });

  // The load-bearing one. If IS adds a field next semester, the deploy must
  // stop rather than silently upload it.
  it('throws on an unrecognised classmate field, naming it', () => {
    const withEmail = {
      ...raw,
      classmates: {
        'EXC-KPSIT': [{ ...raw.classmates['EXC-KPSIT'][0], email: 'jana@mendelu.cz' }],
      },
    };
    expect(() => sanitiseSnapshot(withEmail)).toThrow(/email/);
  });

  it('reports what it changed', () => {
    const { report } = sanitiseSnapshot(raw);
    expect(report.join('\n')).toMatch(/2 classmate/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run scripts/__tests__/sanitiseSnapshot.test.ts`
Expected: FAIL — cannot resolve `../sanitiseSnapshot`.

- [ ] **Step 3: Write the implementation**

Create `scripts/sanitiseSnapshot.ts`:

```ts
/**
 * Removes other students' identities from a scraped snapshot before it is
 * uploaded anywhere.
 *
 * Everything in the snapshot is Dominik's own data except `classmates`, which
 * lists real people. Four of that entry's five fields identify someone:
 * `name`, `personId`, and both `photoUrl` and `messageUrl`, each of which
 * embeds the personId in a URL.
 *
 * Rows and groups are preserved so the UI is exercised identically — long-name
 * wrapping, row counts, an empty group.
 */

/** Every field a classmate entry is allowed to have. Anything else throws. */
const KNOWN_CLASSMATE_FIELDS = ['name', 'personId', 'photoUrl', 'messageUrl', 'studyInfo'] as const;

/** Dropped outright — each one re-identifies the person. */
const DROPPED_CLASSMATE_FIELDS = ['personId', 'photoUrl', 'messageUrl'] as const;

const FIRST_NAMES = ['Jan', 'Eva', 'Petr', 'Lucie', 'Tomas', 'Marie', 'Jakub', 'Tereza'];
const SURNAMES = ['Novak', 'Svobodova', 'Dvorak', 'Cerna', 'Prochazka', 'Kucerova', 'Vesely'];

/**
 * Deterministic from the group and position alone — never from the real name,
 * so the output carries nothing derived from the person it replaces, and two
 * runs of the same snapshot diff cleanly.
 */
function fakeName(group: string, index: number): string {
  let h = 0;
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const seed = Math.abs(h + index * 7919);
  return `${SURNAMES[seed % SURNAMES.length]} ${FIRST_NAMES[(seed >> 3) % FIRST_NAMES.length]}`;
}

export function sanitiseSnapshot(raw: unknown): {
  data: Record<string, unknown>;
  report: string[];
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Snapshot is not an object — refusing to sanitise it.');
  }

  const data = { ...(raw as Record<string, unknown>) };
  const report: string[] = [];
  const classmates = data.classmates;

  if (classmates === undefined || classmates === null) {
    report.push('No classmates in this snapshot — nothing to sanitise.');
    return { data, report };
  }

  if (typeof classmates !== 'object' || Array.isArray(classmates)) {
    throw new Error(
      'Expected `classmates` to be an object keyed by subject code. Refusing to guess at an unfamiliar shape.'
    );
  }

  let rows = 0;
  const cleaned: Record<string, unknown[]> = {};

  for (const [group, entries] of Object.entries(classmates as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      throw new Error(`Expected classmates["${group}"] to be an array.`);
    }
    cleaned[group] = entries.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`classmates["${group}"][${index}] is not an object.`);
      }
      const record = entry as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!KNOWN_CLASSMATE_FIELDS.includes(key as (typeof KNOWN_CLASSMATE_FIELDS)[number])) {
          throw new Error(
            `Unrecognised classmate field "${key}" in classmates["${group}"][${index}]. ` +
              `Refusing to upload a field nobody has reviewed — add it to KNOWN_CLASSMATE_FIELDS ` +
              `in scripts/sanitiseSnapshot.ts once you have decided whether it identifies anyone.`
          );
        }
      }
      const out: Record<string, unknown> = { ...record, name: fakeName(group, index) };
      for (const key of DROPPED_CLASSMATE_FIELDS) delete out[key];
      rows += 1;
      return out;
    });
  }

  data.classmates = cleaned;
  report.push(
    `Renamed ${rows} classmate row(s) across ${Object.keys(cleaned).length} group(s); ` +
      `dropped ${DROPPED_CLASSMATE_FIELDS.join(', ')}.`
  );
  return { data, report };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/__tests__/sanitiseSnapshot.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the CLI wrapper**

Create `scripts/sanitise-snapshot.mjs`:

```js
// Reads the raw scrape and writes the only file a deployed build may ship.
//
// Two separate filenames on purpose: scripts/stripDevRealData.mjs deletes
// dev-real-data.json from every web build unconditionally, with no flag that
// can switch it off. A conditional strip would mean one wrong environment
// variable publishes a real student record.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(root, 'public/dev-real-data.json');
const OUT = resolve(root, 'public/preview-data.json');

if (!existsSync(IN)) {
  console.error(
    `\nNo scrape found at public/dev-real-data.json.\nRun \`npm run scrape:real\` first — it needs MENDELU_USER / MENDELU_PASS in .env.\n`
  );
  process.exit(1);
}

// tsx registers the TS loader; see the npm script.
const require = createRequire(import.meta.url);
const { sanitiseSnapshot } = require('./sanitiseSnapshot.ts');

const { data, report } = sanitiseSnapshot(JSON.parse(readFileSync(IN, 'utf8')));
writeFileSync(OUT, JSON.stringify(data));
for (const line of report) console.log(line);
console.log(`Wrote ${OUT}`);
```

- [ ] **Step 6: Add the script and ignore the output**

In `package.json`, next to `scrape:real`:

```json
"sanitise:snapshot": "tsx --tsconfig tsconfig.app.json scripts/sanitise-snapshot.mjs",
```

In `.gitignore`, directly below the existing `public/dev-real-data.json` entry, add:

```
# Sanitised copy of the above — still a full academic record, still never committed.
public/preview-data.json
```

- [ ] **Step 7: Run it against the real snapshot**

```bash
npm run sanitise:snapshot
node -e "const c=require('./public/preview-data.json').classmates; const e=Object.values(c).flat()[0]; console.log(JSON.stringify(e));"
```
Expected: a report line naming the row count, then an entry with only `name` and `studyInfo`. If `personId`, `photoUrl` or `messageUrl` appear, stop — the sanitiser did not run.

Also confirm the file is not tracked:

```bash
git check-ignore -v public/preview-data.json
```
Expected: a line naming the `.gitignore` rule.

- [ ] **Step 8: Commit**

```bash
git add scripts/sanitiseSnapshot.ts scripts/__tests__/sanitiseSnapshot.test.ts scripts/sanitise-snapshot.mjs package.json .gitignore
git commit -m "$(cat <<'EOF'
feat(scripts): strip other students' identities from the snapshot

classmates is the one part of a scrape that is not Dominik's own data: each row
carries a real student's name, personId, and two URLs that embed that id. Rows
and groups are preserved so the UI is exercised identically.

Fails closed on any field it does not recognise — if IS starts returning an
email address next semester the deploy stops rather than uploading it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Real-data build mode

The deployed page must load the snapshot **and** keep the guards demo mode provides. Clearing demo mode would re-open the CORS loop against `is.mendelu.cz` and the `track_daily_usage` write that were fixed earlier today. So demo mode stays on — it means "offline", not "fake" — and only the data source changes.

**Files:**
- Modify: `dev/bootDemoMode.ts`
- Modify: `dev/__tests__/bootDemoMode.test.ts`
- Modify: `scripts/assert-web-build-env.mjs`
- Modify: `scripts/__tests__/assertWebBuildEnv.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadRealDataSnapshot(url?)` (Task 1), `isPreviewBuild` from `src/utils/harnessEnabled` (Task 1), `preview-data.json` (Task 2).
- Produces: `shouldLoadRealData(env: HarnessEnv & { VITE_PREVIEW_DATA?: string }): boolean` from `dev/bootDemoMode.ts`; the npm script `build:web:real`.

- [ ] **Step 1: Write the failing test**

Append to `dev/__tests__/bootDemoMode.test.ts`:

```ts
describe('shouldLoadRealData', () => {
  it('is on for a preview build asking for real data', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' })).toBe(true);
  });

  it('is off for the demo preview', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ VITE_PREVIEW_BUILD: 'true' })).toBe(false);
  });

  // Belt and braces: the flag alone must not be enough, so a stray
  // VITE_PREVIEW_DATA in someone's .env cannot make a local dev server try to
  // fetch a file that is not there.
  it('needs the preview build too, not just the data flag', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ DEV: true, VITE_PREVIEW_DATA: 'real' })).toBe(false);
  });
});

describe('bootDemoMode in real-data mode', () => {
  it('loads the sanitised snapshot instead of the demo dataset', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const loadSnapshot = vi.fn().mockResolvedValue(true);
    const { bootDemoMode } = await import('../bootDemoMode');

    await bootDemoMode(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      { enterDemo, refresh, loadSnapshot }
    );

    expect(loadSnapshot).toHaveBeenCalledWith('/preview-data.json');
    expect(enterDemo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run dev/__tests__/bootDemoMode.test.ts`
Expected: FAIL — `shouldLoadRealData` is not exported.

- [ ] **Step 3: Implement the branch**

In `dev/bootDemoMode.ts`, add the import:

```ts
import { loadRealDataSnapshot } from '../src/services/loadRealDataSnapshot';
```

Add the predicate and widen the deps object. The existing `bootDemoMode(env, deps)` keeps its `enterDemo` and `refresh` entries; add `loadSnapshot`:

```ts
/** The sanitised snapshot — never the raw `dev-real-data.json`. */
const PREVIEW_DATA_URL = '/preview-data.json';

/**
 * Whether this build loads Dominik's real snapshot instead of the demo dataset.
 *
 * Requires BOTH flags. The preview-build flag alone must not be enough: a stray
 * VITE_PREVIEW_DATA in a local .env would otherwise make `dev:web` fetch a file
 * that is not there and render nothing.
 */
export function shouldLoadRealData(
  env: HarnessEnv & { VITE_PREVIEW_DATA?: string }
): boolean {
  return isPreviewBuild(env) && env.VITE_PREVIEW_DATA === 'real';
}
```

Inside `bootDemoMode`, after the existing early return and inside the `try`, branch before the `enterDemo()` call:

```ts
    if (shouldLoadRealData(env)) {
      // Demo mode is already ON (dev/earlyDemoMode.ts set the flag before the
      // app booted) and stays on — here it means "offline", not "fake". That is
      // what keeps createContextSlice from calling IS Mendelu and feedback.ts
      // from writing track_daily_usage. Only the data source differs.
      await deps.loadSnapshot(PREVIEW_DATA_URL);
    } else {
      await deps.enterDemo();
    }
    await deps.refresh();
    return;
```

Give `loadSnapshot` its default in the same `deps` default object the others use:

```ts
    loadSnapshot: (url: string) => loadRealDataSnapshot(url),
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run dev/__tests__/bootDemoMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Allow the new variable and add the build script**

In `scripts/assert-web-build-env.mjs`, change the allowlist line to:

```js
const ALLOWED_VITE_VARS = ['VITE_DEV_SOCIETY', 'VITE_PREVIEW_BUILD', 'VITE_PREVIEW_DATA'];
```

In `scripts/__tests__/assertWebBuildEnv.test.ts`, add:

```ts
  it('allows the real-data flag', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_DEV_SOCIETY: 'reis',
        VITE_PREVIEW_BUILD: 'true',
        VITE_PREVIEW_DATA: 'real',
      })
    ).toEqual([]);
  });
```

In `package.json`, next to `build:web`:

```json
"build:web:real": "test -f public/preview-data.json || (echo 'Missing public/preview-data.json — run npm run sanitise:snapshot first' && exit 1) && VITE_PREVIEW_DATA=real npm run build:web",
```

- [ ] **Step 6: Verify in a browser, which is the only proof that counts**

```bash
npm run build:web:real
npx --yes serve dist-web -l 4190
```

Open `http://localhost:4190/?mobile=1` in the Browser pane and report what you actually see:
- Real subjects and the real schedule render — not skeletons, not the demo's `Algoritmizace` / `Statistika`.
- **No classmate is shown under a real name.**
- `performance.getEntriesByType('resource')` contains **no** `track_daily_usage`, **no** `report_error_v2` and **no** `is.mendelu.cz`.
- `dist-web/dev-real-data.json` does not exist; `dist-web/preview-data.json` does.

If skeletons appear, the boot ordering is wrong — do not proceed.

- [ ] **Step 7: Commit**

```bash
git add dev/bootDemoMode.ts dev/__tests__/bootDemoMode.test.ts scripts/assert-web-build-env.mjs scripts/__tests__/assertWebBuildEnv.test.ts package.json
git commit -m "$(cat <<'EOF'
feat(dev): load the sanitised snapshot in the real-data preview build

Demo mode stays ON in this mode and means "offline", not "fake" — it is what
keeps createContextSlice off IS Mendelu and feedback.ts off track_daily_usage.
Only the data source changes.

Both flags are required, so a stray VITE_PREVIEW_DATA in a local .env cannot
make dev:web fetch a file that is not there.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Show how old the data is

Refreshing is manual, so a three-week-old snapshot looks identical to a fresh one. Without a visible date, a screen that is "wrong" because the data is stale costs an afternoon.

**Files:**
- Create: `dev/snapshotAge.ts`
- Create: `dev/__tests__/snapshotAge.test.ts`
- Modify: `dev/main.web.tsx`

**Interfaces:**
- Consumes: `shouldLoadRealData` (Task 3).
- Produces: `formatSnapshotAge(lastSync: string, now: Date): string` and `mountSnapshotAge(env, lastSync, doc?)` from `dev/snapshotAge.ts`.

- [ ] **Step 1: Write the failing test**

Create `dev/__tests__/snapshotAge.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { formatSnapshotAge, mountSnapshotAge } from '../snapshotAge';

const NOW = new Date('2026-09-04T12:00:00.000Z');

describe('formatSnapshotAge', () => {
  it('says today for a snapshot taken this morning', () => {
    expect(formatSnapshotAge('2026-09-04T08:00:00.000Z', NOW)).toBe('data scraped today');
  });

  it('counts whole days', () => {
    expect(formatSnapshotAge('2026-09-02T08:00:00.000Z', NOW)).toBe('data scraped 2 days ago');
  });

  it('uses the singular for one day', () => {
    expect(formatSnapshotAge('2026-09-03T08:00:00.000Z', NOW)).toBe('data scraped 1 day ago');
  });

  // An unreadable date must not silently render as "today", which would be the
  // most misleading possible answer.
  it('says so when the date cannot be read', () => {
    expect(formatSnapshotAge('not-a-date', NOW)).toBe('snapshot date unknown');
  });
});

describe('mountSnapshotAge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows nothing outside the real-data build', () => {
    mountSnapshotAge({ VITE_PREVIEW_BUILD: 'true' }, '2026-09-04T08:00:00.000Z', document);
    expect(document.querySelector('[data-testid="snapshot-age"]')).toBeNull();
  });

  it('shows the age in the real-data build', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      '2026-09-02T08:00:00.000Z',
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toContain('2 days ago');
  });

  it('mounts only once', () => {
    const env = { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' };
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', document);
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', document);
    expect(document.querySelectorAll('[data-testid="snapshot-age"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run dev/__tests__/snapshotAge.test.ts`
Expected: FAIL — cannot resolve `../snapshotAge`.

- [ ] **Step 3: Implement it**

Create `dev/snapshotAge.ts`:

```ts
import { shouldLoadRealData } from './bootDemoMode';
import type { HarnessEnv } from '../src/utils/harnessEnabled';

const ELEMENT_ID = 'reis-snapshot-age';
const MS_PER_DAY = 86_400_000;

/**
 * How stale the real-data preview is, in words.
 *
 * An unreadable date returns "unknown" rather than falling back to "today" —
 * the one answer that would actively mislead.
 */
export function formatSnapshotAge(lastSync: string, now: Date): string {
  const then = new Date(lastSync);
  if (Number.isNaN(then.getTime())) return 'snapshot date unknown';

  const days = Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
  if (days <= 0) return 'data scraped today';
  if (days === 1) return 'data scraped 1 day ago';
  return `data scraped ${days} days ago`;
}

/**
 * Paints the age on the real-data preview only.
 *
 * That build is refreshed by hand, so a three-week-old snapshot is
 * indistinguishable from a fresh one without this. The demo preview carries no
 * chrome of its own by design — this is the exception, and it earns it.
 */
export function mountSnapshotAge(
  env: HarnessEnv & { VITE_PREVIEW_DATA?: string },
  lastSync: string | undefined,
  doc: Document = document
): void {
  if (!shouldLoadRealData(env)) return;
  if (doc.getElementById(ELEMENT_ID)) return;

  const el = doc.createElement('div');
  el.id = ELEMENT_ID;
  el.dataset.testid = 'snapshot-age';
  el.className =
    'fixed top-0 right-0 z-50 bg-base-300 text-base-content/70 text-[10px] px-2 py-0.5 rounded-bl';
  el.textContent = lastSync ? formatSnapshotAge(lastSync, new Date()) : 'snapshot date unknown';
  doc.body.appendChild(el);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run dev/__tests__/snapshotAge.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Mount it after the snapshot has loaded**

In `dev/main.web.tsx`, replace the existing `void bootDemoMode(import.meta.env);` line with:

```ts
// Then the snapshot's age, once the data is in — the real-data preview is
// refreshed by hand, so a stale snapshot has to be visible as stale.
void bootDemoMode(import.meta.env).then(async () => {
  const { mountSnapshotAge } = await import('./snapshotAge');
  const { useAppStore } = await import('../src/store/useAppStore');
  mountSnapshotAge(import.meta.env, useAppStore.getState().syncStatus?.lastSync);
});
```

**Before writing this, check the real field name.** Run:

```bash
node -e "console.log(Object.keys(require('./public/dev-real-data.json')).filter(k=>/sync/i.test(k)))"
grep -rn "lastSync" src/store/types.ts src/types/messages.ts | head -5
```

The snapshot's top-level key is `lastSync`. Confirm where the store puts it after `REIS_SYNC_UPDATE` and read it from there; if it is not on `syncStatus`, use the path that actually holds it and say so in your report.

- [ ] **Step 6: Verify in the browser**

```bash
npm run build:web:real && npx --yes serve dist-web -l 4191
```

Open it and confirm the age badge is present, reads plausibly against the snapshot's real `lastSync`, and does not overlap the app header at 390px width. Report what you saw.

- [ ] **Step 7: Commit**

```bash
git add dev/snapshotAge.ts dev/__tests__/snapshotAge.test.ts dev/main.web.tsx
git commit -m "$(cat <<'EOF'
feat(dev): show how old the real-data preview is

That build is refreshed by hand, so a three-week-old snapshot looks exactly like
a fresh one. An unreadable date reads as "unknown" rather than "today", which
would be the most misleading possible answer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The gated Vercel project and the one command

Infrastructure plus the script that ties the previous four tasks together.

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the npm script `preview:real`; a Vercel project `reis-extension-real`.

- [ ] **Step 1: Create the project**

The Vercel CLI on this machine is already authenticated. Create the project with **no git integration**, so nothing but this command can deploy it:

```bash
TOK=$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json','utf8')).token)")
curl -s -X POST "https://api.vercel.com/v11/projects" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"name":"reis-extension-real","framework":"vite","buildCommand":"npm run build:web:real","outputDirectory":"dist-web","installCommand":"npm ci","environmentVariables":[
        {"key":"VITE_DEV_SOCIETY","value":"reis","type":"plain","target":["production"]},
        {"key":"VITE_PREVIEW_BUILD","value":"true","type":"plain","target":["production"]},
        {"key":"VITE_PREVIEW_DATA","value":"real","type":"plain","target":["production"]}]}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log(p.error?('ERR '+JSON.stringify(p.error)):('id: '+p.id))})"
```

Record the returned project id — the next step needs it.

- [ ] **Step 2: Turn the login gate on, and system-env injection off**

Replace `<PROJECT_ID>` with the id from step 1:

```bash
TOK=$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json','utf8')).token)")
curl -s -X PATCH "https://api.vercel.com/v9/projects/reis-extension-real" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"ssoProtection":{"deploymentType":"all_except_custom_domains"},"autoExposeSystemEnvs":false}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log('sso:',JSON.stringify(p.ssoProtection),'autoExpose:',p.autoExposeSystemEnvs)})"
```

Expected: `sso: {"deploymentType":"all_except_custom_domains"} autoExpose: false`.

`autoExposeSystemEnvs` must be off for the same reason it is off on the first project: Vercel otherwise injects nineteen `VITE_VERCEL_*` variables and the build allowlist rejects them.

- [ ] **Step 3: Add the command**

`vercel deploy --prebuilt` reads `.vercel/output`, which only `vercel build`
produces — verified with `vercel deploy --help`: *"Use in combination with
`vc build`"*. So the chain runs `vercel build`, which itself invokes the
project's configured `buildCommand` (`npm run build:web:real`); do **not** also
run `build:web:real` directly, or it builds twice.

The CLI needs to know which project this is, and `.vercel/project.json` is
gitignored and already points at the *public* project. Pass the ids by
environment instead. They are identifiers, not secrets, but they belong in
`.env` (already gitignored) rather than in `package.json`:

```
VERCEL_ORG_ID=<from the create-project response's accountId>
VERCEL_PROJECT_ID=<the id recorded in Step 1>
```

In `package.json`:

```json
"preview:real": "npm run scrape:real && npm run sanitise:snapshot && npx vercel build --prod && npx vercel deploy --prebuilt --prod",
```

`&&` throughout is load-bearing: a failed scrape or a rejected field must stop
the chain, not deploy the previous build's output as if it were fresh.

**Verify the chain actually picks the gated project** before trusting it — a
mis-set id would deploy your real data to the PUBLIC project. After the first
run, confirm the deployment URL belongs to `reis-extension-real`, and re-run
Step 4's logged-out `curl` against that exact URL.

- [ ] **Step 4: Run it, and verify the gate before anything else**

```bash
npm run preview:real
```

Then, **logged out** (use `curl`, which carries no Vercel session):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://reis-extension-real.vercel.app/
```
Expected: `302` — redirected to Vercel's login. **If this returns 200, stop immediately**: the deployment is public and it is holding your academic record. Re-check step 2 before doing anything else.

- [ ] **Step 5: Verify the content, logged in**

Open the deployment in the Browser pane and confirm:
- Your real subjects, schedule and files render.
- The snapshot-age badge shows today.
- No classmate appears under a real name.
- `performance.getEntriesByType('resource')` shows no `track_daily_usage`, no `report_error_v2` and no `is.mendelu.cz`.
- `https://<deployment>/dev-real-data.json` does not return JSON.

- [ ] **Step 6: Document it**

In `CLAUDE.md`, in the "Branches and releasing" section added earlier, append:

```markdown
- Two previews, deliberately different. `test` auto-deploys a **public** build
  on the synthetic demo dataset — that link is shareable. `npm run preview:real`
  deploys a **login-gated** build on your own scraped data to a separate Vercel
  project; only you can open it. Your MENDELU credentials never leave your
  laptop and are never in CI. The gated build shows how old its snapshot is,
  because refreshing it is manual.
```

- [ ] **Step 7: Commit and open the PR**

```bash
git add package.json CLAUDE.md
git commit -m "$(cat <<'EOF'
feat: one command for the login-gated real-data preview

scrape -> sanitise -> build -> deploy, chained with && so a failed scrape or a
rejected field stops rather than redeploying stale output. Runs only from a
laptop: no MENDELU credential is in the repository or in CI.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push personal HEAD
gh pr create --repo reis-mendelu/reis-extension --base test --head feat/real-data-preview \
  --title "feat: login-gated preview running my own IS data"
```

---

## Self-review

**Spec coverage.** Sanitiser → Task 2. Separate-filename rule → Tasks 2 and 3. Widened loader guards and the URL parameter → Task 1. Real-data build mode → Task 3. `lastSync` visibility → Task 4. Vercel project, SSO, `autoExposeSystemEnvs` → Task 5. `preview:real` → Task 5. No-credentials-in-CI → global constraints, and no task adds a workflow. Branch protection was applied before this plan and needs no task.

**Known open question, deliberately left to the implementer:** the spec keeps classmate `studyInfo`. Dominik was asked whether to drop it and has not answered. Task 2 keeps it and its test asserts it survives. If he says drop it, that is a one-line change to `DROPPED_CLASSMATE_FIELDS` plus the test — do not make that call unasked.

**Sequencing.** Task 1 is a hard prerequisite for 3, 4 and 5. Task 2 is independent of 1 and could run in parallel, but 3 needs both. 4 needs 3. 5 needs all.
