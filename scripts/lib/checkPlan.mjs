// The pure half of `npm run check` (scripts/check.mjs): what is installed, what
// changed, what to run, and the one line that says how it went. No I/O here, so
// every decision the command makes is unit-tested.

/**
 * Packages whose installed version is not the locked one.
 *
 * `lock` is package-lock.json; `installed` is node_modules/.package-lock.json,
 * the record npm writes last, when an install has finished — so a killed
 * install or a half-copied tree has none, or an old one, and shows up here.
 * A worktree keeps whatever was installed when it was made: one copied from an
 * old install ran vitest 3 under a lockfile pinning 5 and failed in ways that
 * looked like real bugs.
 */
export function staleInstall(lock, installed) {
  const have = installed?.packages ?? {};
  const stale = [];
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    // The root, the native/ workspaces and their links carry no installed copy.
    if (!path.startsWith('node_modules/') || entry.link) continue;
    const found = have[path];
    // npm skips another platform's optional binaries: absent is correct.
    if (!found && entry.optional) continue;
    if (found?.version === entry.version) continue;
    stale.push({
      name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
      want: entry.version,
      have: found?.version ?? null,
    });
  }
  return stale;
}

const LINTED = /\.tsx?$/;
const CODE = /\.(?:[cm]?[jt]sx?|json)$/;

/**
 * What to run for a set of changed files.
 *
 * - `lint`: what eslint.config.js covers (`**\/*.{ts,tsx}`); CI lints the whole
 *   repo, but only a changed file can have a new finding.
 * - `format`: everything; prettier applies .prettierignore itself.
 * - `tests`: arguments for `vitest related`. The guard tests are always in the
 *   list: they read files through fs, so no import graph ties them to a change,
 *   and a docs-only edit that breaks one would otherwise pass here and fail CI.
 */
export function planFromChanges(changed, alwaysRun) {
  return {
    lint: changed.filter((f) => LINTED.test(f)),
    format: [...changed],
    tests: [...new Set([...changed.filter((f) => CODE.test(f)), ...alwaysRun])],
  };
}

/**
 * The base this branch sits closest to: `{ ref, sha, ahead }` candidates, where
 * `ahead` counts the branch's commits on top of the merge-base with that ref.
 *
 * Both are tried because a session worktree is cut from main, and main is not
 * an ancestor of test (releases squash): diffing such a branch against test
 * would report every file changed since the last release.
 */
export function closestBase(candidates) {
  const preferTest = (c) => (c.ref.endsWith('/test') ? 0 : 1);
  return (
    [...candidates].sort((a, b) => a.ahead - b.ahead || preferTest(a) - preferTest(b))[0] ?? null
  );
}

/** The last line the command prints, and the only one a reader needs. */
export function verdict(results) {
  if (results.length === 0) return 'check: FAIL (nothing ran)';
  const label = (r) => (r.detail ? `${r.step}: ${r.detail}` : r.step);
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  if (failed.length === 0) return `check: PASS (${passed.map(label).join(', ')})`;
  const tail = passed.length > 0 ? ` — passed: ${passed.map(label).join(', ')}` : '';
  return `check: FAIL (${failed.map(label).join(', ')})${tail}`;
}
