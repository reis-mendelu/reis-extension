# noUncheckedIndexedAccess Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution is designed to run on **Sonnet via `/loop`**, one directory per PR.

**Goal:** Enable TypeScript's `noUncheckedIndexedAccess` in `tsconfig.app.json` with zero errors, migrated incrementally one directory per PR behind a home-grown ratchet gate.

**Architecture:** The flag stays OFF in the committed `tsconfig.app.json` throughout the migration. A CI-enforced ratchet gate (`scripts/nuia-gate.mjs` + `nuia-baseline.json`) runs `tsc` WITH the flag and fails if (a) any file NOT in the baseline errors, or (b) any baselined file is now clean but still listed (forcing the baseline to shrink). Each directory PR fixes that directory's files and removes them from the baseline. When the baseline is empty, a final PR flips the real flag on and deletes the gate.

**Tech Stack:** TypeScript 5.9 (`tsc`), Node ESM script, existing GitHub Actions CI (`.github/workflows/ci.yml`), Vitest (unchanged).

## Global Constraints

- **Baseline (measured 2026-07-06):** 732 errors across 161 files. Per-directory file counts (errors): `components` 269, `api` 207, `utils` 154, `services` 28, `hooks` 18, `types` 16, `store` 13, `data` 12, `schemas` 10, `injector` 5.
- **Never global-flip in one PR.** The real flag flips only in the final task, after the baseline is empty.
- **Fix-playbook rule:** NEVER silence an error with a non-null assertion `!` unless a guard/length-check on the SAME code path provably makes it safe — and then add a one-line comment saying why. Prefer real guards, optional chaining, `?? fallback`, or restructuring. See the Fix Playbook appendix for per-error-code recipes.
- **Genuinely ambiguous site:** use `// @ts-expect-error nuia: <reason>` on the erroring line (self-removing, greppable) — NOT `!`, NOT a silent change. This lets the file leave the baseline while marking debt.
- **Parser files are load-bearing and MUST NOT be altered to satisfy the flag.** For `src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, and everything under `src/utils/parsers/`, suppress each erroring line with `// @ts-expect-error nuia: parser load-bearing (see CLAUDE.md Parser Rules)` — adding a comment is allowed; changing parser logic or column-index constants is not.
- **Every PR must pass the 5 required checks:** `UI/UX gate (changed files)`, `CodeQL`, `Typecheck`, `Unit tests`, `Format (changed files)`. The ratchet gate runs INSIDE the existing `Typecheck` job (no new required check → no branch-protection change needed).
- **Behavior-preserving only.** These fixes add guards; they must not change runtime behavior. If a guard would change behavior (e.g. skipping an iteration that currently runs), that's a real bug — fix it correctly and note it in the PR, don't paper over it.

---

### Task 0: Ratchet gate infrastructure

**Files:**
- Create: `scripts/nuia-gate.mjs`
- Create: `nuia-baseline.json`
- Modify: `package.json` (add two scripts)
- Modify: `.github/workflows/ci.yml` (run the gate inside the existing Typecheck job)

**Interfaces:**
- Produces: `npm run typecheck:nuia` (raw flag-on tsc) and `npm run nuia:gate` (the ratchet check, exit 1 on violation). `nuia-baseline.json` is a JSON array of repo-relative POSIX file paths still allowed to error.

- [ ] **Step 1: Write the gate script**

Create `scripts/nuia-gate.mjs`:

```js
// Ratchet gate for the noUncheckedIndexedAccess migration.
// Runs tsc WITH the flag, compares the set of erroring files against
// nuia-baseline.json, and fails if new files error OR a baselined file is
// already clean (forcing the baseline to shrink). Delete this script and the
// baseline in the final task once the real flag is flipped on.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const baseline = new Set(JSON.parse(readFileSync('nuia-baseline.json', 'utf8')));

let out = '';
try {
  execSync('npx tsc -p tsconfig.app.json --noUncheckedIndexedAccess --noEmit', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

// tsc line format: "src/api/foo.ts(12,5): error TS2532: ..."
const erroring = new Set();
for (const line of out.split('\n')) {
  const m = line.match(/^([^(]+\.tsx?)\(\d+,\d+\): error TS/);
  if (m) erroring.add(m[1].replaceAll('\\', '/'));
}

const newErrors = [...erroring].filter((f) => !baseline.has(f)).sort();
const staleBaseline = [...baseline].filter((f) => !erroring.has(f)).sort();

if (newErrors.length) {
  console.error('❌ NEW noUncheckedIndexedAccess errors (not in baseline) — fix them:');
  for (const f of newErrors) console.error(`   ${f}`);
}
if (staleBaseline.length) {
  console.error('❌ Baseline entries that are now clean — REMOVE them from nuia-baseline.json:');
  for (const f of staleBaseline) console.error(`   ${f}`);
}
if (newErrors.length || staleBaseline.length) process.exit(1);

console.log(`✅ nuia ratchet ok — ${erroring.size} files still in baseline`);
```

- [ ] **Step 2: Generate the initial baseline**

Run (this seeds `nuia-baseline.json` with exactly today's 161 erroring files):

```bash
npx tsc -p tsconfig.app.json --noUncheckedIndexedAccess --noEmit 2>&1 \
  | grep -oE '^[^(]+\.tsx?' | sed 's#\\\\#/#g' | sort -u \
  | node -e 'const fs=require("fs");const a=require("fs").readFileSync(0,"utf8").split("\n").filter(Boolean);fs.writeFileSync("nuia-baseline.json",JSON.stringify(a,null,2)+"\n")'
```

Expected: `nuia-baseline.json` contains ~161 paths.

- [ ] **Step 3: Verify the gate passes on the untouched baseline**

Run: `node scripts/nuia-gate.mjs`
Expected: `✅ nuia ratchet ok — 161 files still in baseline` (exit 0).

- [ ] **Step 4: Add npm scripts**

In `package.json` `"scripts"`, add:

```json
"typecheck:nuia": "tsc -p tsconfig.app.json --noUncheckedIndexedAccess --noEmit",
"nuia:gate": "node scripts/nuia-gate.mjs"
```

- [ ] **Step 5: Wire the gate into the existing Typecheck CI job**

In `.github/workflows/ci.yml`, find the `Typecheck` job's steps and add, immediately after the existing `npm run typecheck` step:

```yaml
      - name: noUncheckedIndexedAccess ratchet gate
        run: npm run nuia:gate
```

(This keeps the gate inside an already-required check — no new required status context, so branch protection is untouched.)

- [ ] **Step 6: Sanity-check the whole thing locally**

Run: `npm run nuia:gate`
Expected: exit 0, `✅ nuia ratchet ok`.

- [ ] **Step 7: Commit**

```bash
git add scripts/nuia-gate.mjs nuia-baseline.json package.json .github/workflows/ci.yml
git commit -m "build(ts): add noUncheckedIndexedAccess ratchet gate (baseline 161 files)"
```

Open a PR, wait for all 5 checks green, merge with `gh pr merge <N> --squash --delete-branch`.

---

## Per-Directory Procedure (Tasks 1–10 all follow this — it is one `/loop` iteration)

Every directory task is the SAME procedure; only `<DIR>` changes. Do them in this order (smallest first, to validate the gate + playbook cheaply before the monsters): **injector → schemas → data → store → types → hooks → services → utils → api → components.**

For directory `<DIR>` (branch `hardening/nuia-<DIR>`):

- [ ] **Step 1: List this directory's erroring files**

```bash
npm run typecheck:nuia 2>&1 | grep -oE '^src/<DIR>/[^(]+\.tsx?' | sort -u
```

These are the files to fix in this PR. (Cross-check: they are all present in `nuia-baseline.json`.)

- [ ] **Step 2: Fix each file** following the Fix Playbook appendix. Parser files (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/utils/parsers/**`) get `// @ts-expect-error nuia: parser load-bearing` per erroring line — never edit parser logic.

- [ ] **Step 3: Remove the now-fixed files from the baseline**

Delete this directory's entries from `nuia-baseline.json` (every `src/<DIR>/...` path).

- [ ] **Step 4: Run the gate**

Run: `npm run nuia:gate`
Expected: exit 0. If it reports "NEW errors" you introduced a regression elsewhere — fix it. If it reports "stale baseline" for a `src/<DIR>/` file you missed removing, remove it. If it reports a `src/<DIR>/` file as still erroring, you didn't fully fix that file.

- [ ] **Step 5: Run typecheck + the full unit suite** (behavior-preservation gate)

Run: `npm run typecheck && npx vitest run --exclude '**/parsers/iskam/__tests__/**'`
Expected: typecheck clean, all tests pass. A test failure means a fix changed behavior — correct it.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write $(git diff --name-only -- 'src/**/*.ts' 'src/**/*.tsx' nuia-baseline.json)
git add -A
git commit -m "refactor(<DIR>): satisfy noUncheckedIndexedAccess in src/<DIR> (ratchet down)"
```

- [ ] **Step 7: PR + merge on green**

Push, open PR, wait for all 5 checks, `gh pr merge <N> --squash --delete-branch`.

### Task 1 — worked example: `injector` (pilot, 5 errors)

Do the Per-Directory Procedure with `<DIR>=injector`. It's the smallest directory — use it to confirm the gate ratchets (baseline drops from 161 to ~160 files) and the playbook feels right before scaling up. Concretely, Step 1 yields the ~2–3 injector files; a typical fix looks like:

```ts
// before — TS2532: 'parts[1]' is possibly 'undefined'
const id = url.split('/')[1].trim();
// after — guard, no assertion
const id = url.split('/')[1]?.trim();
if (!id) return; // or: ?? '' if empty-string is the correct fallback
```

Tasks 2–10 (`schemas`, `data`, `store`, `types`, `hooks`, `services`, `utils`, `api`, `components`) are the identical procedure with their `<DIR>`. `utils`/`api`/`components` are the large ones — they may be split into two PRs each (e.g. `api` by subfolder) if a single PR exceeds ~40 changed files; the gate doesn't care about PR granularity, only that the baseline shrinks and never grows.

---

### Task 11: Flip the flag, remove the gate

**Files:**
- Modify: `tsconfig.app.json`
- Delete: `scripts/nuia-gate.mjs`, `nuia-baseline.json`
- Modify: `package.json` (remove the two temporary scripts)
- Modify: `.github/workflows/ci.yml` (remove the gate step)

**Precondition:** `nuia-baseline.json` is `[]` (empty) — every directory task merged.

- [ ] **Step 1: Confirm zero errors with the flag**

Run: `npm run typecheck:nuia`
Expected: exit 0, no output.

- [ ] **Step 2: Enable the flag permanently**

In `tsconfig.app.json` `compilerOptions`, add `"noUncheckedIndexedAccess": true`.

- [ ] **Step 3: Verify the normal typecheck now enforces it**

Run: `npm run typecheck`
Expected: clean (the flag is now part of the standard build).

- [ ] **Step 4: Remove the scaffolding**

```bash
git rm scripts/nuia-gate.mjs nuia-baseline.json
```

Remove `"typecheck:nuia"` and `"nuia:gate"` from `package.json` scripts, and delete the `noUncheckedIndexedAccess ratchet gate` step from `.github/workflows/ci.yml`.

- [ ] **Step 5: Final verify + commit**

Run: `npm run typecheck && npm run build`
Expected: both clean.

```bash
git add -A
git commit -m "build(ts): enable noUncheckedIndexedAccess globally, remove ratchet scaffold"
```

PR, all 5 checks green, merge.

---

## Fix Playbook (appendix — the per-error-code recipes Sonnet follows)

**TS2532 / TS18048 — object/value possibly undefined** (from `arr[i]`, `map[key]`, `match[1]`). This is 540 of the 732. Options, in order of preference:

1. **Guard then use:**
   ```ts
   const item = list[i];
   if (!item) continue; // or return / throw — match surrounding control flow
   use(item);
   ```
2. **Optional chaining** when it's a read chain and `undefined` propagating is acceptable:
   ```ts
   const name = rows[0]?.cells[2]?.textContent;
   ```
3. **Nullish fallback** when a sensible default exists:
   ```ts
   const count = counts[key] ?? 0;
   const cfg = table[k] ?? {};
   ```
4. **Iterate values, not indices** when the index was only used to read:
   ```ts
   for (const row of rows) { … }   // instead of rows[i]
   ```
5. **Non-null assertion `!` — LAST RESORT, only when provably safe** (a length check or fixed tuple on the same path), always with a comment:
   ```ts
   if (parts.length < 2) return;
   const id = parts[1]!; // safe: length checked above
   ```

**TS2345 / TS2322 — undefined not assignable to param/type.** These cascade from the above: a value widened to `T | undefined` is passed where `T` is required. Fix the SOURCE (guard the value before the call/assignment), do not cast the argument:
```ts
const subject = subjects[code];
if (!subject) return;      // now subject is T, not T | undefined
render(subject);           // TS2345 gone
```

**TS2339 / TS2538 / TS2722 / TS2488** (small counts) — same root: an index access produced `undefined` that's then dereferenced, used as an index, called, or iterated. Guard the intermediate value first.

**Genuinely ambiguous / unsafe to restructure:** `// @ts-expect-error nuia: <one-line reason>` on the erroring line. Greppable later; self-removes if the error ever disappears.

**Parser files** (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/utils/parsers/**`): suppress every erroring line with `// @ts-expect-error nuia: parser load-bearing (see CLAUDE.md Parser Rules)`. Do not add guards or change any logic/constants.

---

## Self-Review notes

- **Spec coverage:** all 10 erroring directories have a task (Tasks 1–10 via the procedure); setup (Task 0) and flip (Task 11) bracket them. Parser-file rule, `!`-avoidance rule, and the 5-check gate are encoded in Global Constraints + Playbook.
- **Enforcement:** the gate lives inside the existing required `Typecheck` job, so every PR is enforced without a branch-protection change (which the agent cannot make).
- **Ratchet correctness:** the gate fails both on new errors and on stale baseline entries, so the baseline can only shrink and can never silently drift — safe for unattended Sonnet auto-merge.
- **Types:** the only shared artifact between tasks is `nuia-baseline.json` (a string array) and the two npm scripts; names are consistent across Task 0, the procedure, and Task 11.
