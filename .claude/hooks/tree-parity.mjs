#!/usr/bin/env node
/**
 * Stop hook: did this turn change one UI tree and leave the other alone?
 *
 * reIS ships three products from one codebase, but has only TWO UI trees —
 * `src/App.tsx` forks on `isPhone`, and the iPad runs the phone tree. So the
 * question worth asking at the end of a turn is never "did you do three?", it
 * is "you changed the desktop tree, did you mean to leave the mobile tree
 * alone?". CLAUDE.md > Products and UI trees states the rule; this is the
 * backstop for when it is read and then forgotten mid-task.
 *
 * Why a Stop hook and not PreToolUse, like guard-parsers.py: every feature's
 * FIRST edit is single-tree. At edit time the signal cannot tell in-progress
 * from forgotten, so a PreToolUse version would fire on all of them. By the
 * end of a turn that excuse is gone.
 *
 * Why import closures and not paths: `src/components/**` minus `mobile/**` is
 * NOT "desktop" — mobile/screens/MapScreen.tsx imports CampusMap/MapCanvas.
 * Measured over the 23 most recent src-touching commits, closure
 * classification fires on 3; the naive path rule fired on 17, almost all of
 * them shared map code. The closure is recomputed on every run, so there is no
 * allowlist to rot.
 *
 * Escape hatch: a guard under `src/test/guards/` that NAMES a file clears that
 * file. That is the repo's own idiom for a decided divergence — see
 * desktopHasNoShowOnMap.test.ts, which lists its files by path. Deliberately
 * per-file rather than per-turn: silencing the whole turn would also hide a
 * second capability forgotten alongside the pinned one.
 *
 * The classifier is exported because src/test/guards/treeParityHookSees.test.ts
 * imports it: a guard whose entry points have been renamed goes quiet, and a
 * quiet guard is indistinguishable from a passing one.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOBILE_ENTRY = ['src/components/mobile/MobileApp.tsx'];
export const DESKTOP_ENTRY = [
  'src/components/Sidebar.tsx',
  'src/components/AppMain.tsx',
  'src/components/AppOverlays.tsx',
];

const resolveSpec = (spec, from) => {
  let base;
  if (spec.startsWith('@/')) base = join('src', spec.slice(2));
  else if (spec.startsWith('.')) base = normalize(join(dirname(from), spec));
  else return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
};

/** Every module reachable from `entries`, as repo-relative paths. */
export const closure = (entries) => {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
      const next = resolveSpec(m[1], file);
      if (next && !seen.has(next)) stack.push(next);
    }
  }
  return seen;
};

/**
 * Which of `changed` only one tree can render. A file in both closures is
 * shared and therefore already on both products.
 *
 * `pinnedText` is the concatenated contents of any `src/test/guards/` file this
 * turn touched. A file that one of them NAMES is a decided divergence and drops
 * out — desktopHasNoShowOnMap.test.ts lists its files by path, which is what
 * makes this mechanical. Touching a guard does not silence the whole turn: a
 * second capability forgotten alongside the pinned one still has to be
 * answered.
 */
export const classify = (changed, mobile, desktop, pinnedText = '') => {
  const pinned = (f) => pinnedText.length > 0 && pinnedText.includes(f.replace(/^src\//, ''));
  const oneSided = (inTree, notInTree) =>
    [...changed].filter((f) => inTree.has(f) && !notInTree.has(f) && !pinned(f));
  return {
    desktopOnly: oneSided(desktop, mobile),
    mobileOnly: oneSided(mobile, desktop),
  };
};

const NEXT_STEPS =
  '\n\nDo ONE of these, then stop:\n' +
  '  1. Implement the same capability on the other tree.\n' +
  '  2. If the asymmetry is deliberate, pin it with its reason in src/test/guards/, naming these ' +
  'files (follow desktopHasNoShowOnMap.test.ts). Naming them is what clears them here.\n' +
  '  3. If it is genuinely not a user-facing capability, say so in one line to the user and stop — ' +
  'this will not ask twice about the same set of files.';

export const buildReason = ({ desktopOnly, mobileOnly }) => {
  if (desktopOnly.length && !mobileOnly.length) {
    return (
      'This turn changed the DESKTOP tree only — no file exclusive to the phone/iPad tree was touched:\n' +
      desktopOnly.map((f) => `  - ${f}`).join('\n') +
      '\n\nreIS ships one feature set across three products (Chrome extension, iOS, Android) from two ' +
      'UI trees, and the iPad runs the phone tree. Most features belong on both. The phone tree is ' +
      'src/components/mobile/ — and check it at tablet width too: useWideViewport is the only JS ' +
      'tablet branch, but md:/lg: utilities branch the layout in CSS as well.' +
      NEXT_STEPS
    );
  }
  if (mobileOnly.length && !desktopOnly.length) {
    return (
      'This turn changed the PHONE/iPad tree only — no file exclusive to the desktop tree was touched:\n' +
      mobileOnly.map((f) => `  - ${f}`).join('\n') +
      '\n\nThe Chrome extension renders the desktop tree (Sidebar + AppMain + AppOverlays) and will not ' +
      'show this. Watch the trap in CLAUDE.md on the way back: a mobile-only dependency reaching shared ' +
      'code lands in the extension content script (PR #266).' +
      NEXT_STEPS
    );
  }
  return null;
};

const main = () => {
  const ok = () => process.exit(0);

  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    /* a hook must never fail the turn on malformed input */
  }
  // Belt only: this field is absent from the published Stop input field list,
  // so it cannot be relied on. The braces are the fingerprint marker below.
  if (payload.stop_hook_active) ok();

  const git = (...args) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  };

  // Everything this branch changed: committed since it left the release line,
  // plus the working tree. --others is required because `git diff` does not
  // list untracked files, so a NEW component would otherwise be invisible.
  // Note what the closure can and cannot see: a new file counts only once
  // something imports it. An unwired file ships nothing, so that is the honest
  // reading rather than a gap.
  const base = ['origin/test', 'origin/main', 'test', 'main']
    .map((ref) => git('merge-base', 'HEAD', ref).trim())
    .find(Boolean);
  const changed = new Set(
    [
      git('diff', '--name-only', 'HEAD', '--', 'src'),
      // Scoped to src, which is all this hook looks at anyway. Unscoped it
      // walks the whole worktree: 0.2s idle but 12s measured under load here.
      // A hook killed on timeout does nothing while still looking like a pass,
      // which is why settings.json allows it 60s and this stays scoped. The
      // whole hook is ~1.2s on an unloaded machine.
      git('ls-files', '--others', '--exclude-standard', '--', 'src'),
      base ? git('diff', '--name-only', `${base}...HEAD`, '--', 'src') : '',
    ]
      .join('\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((f) => f.startsWith('src/') && /\.tsx?$/.test(f))
  );
  if (!changed.size) ok();

  const mobile = closure(MOBILE_ENTRY);
  const desktop = closure(DESKTOP_ENTRY);
  // Entry points moved. Stay quiet rather than cry wolf; the guard test fails.
  if (mobile.size < 2 || desktop.size < 2) ok();

  const pinnedText = [...changed]
    .filter((f) => f.startsWith('src/test/guards/') && existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  const sets = classify(changed, mobile, desktop, pinnedText);
  const reason = buildReason(sets);
  if (!reason) ok();

  // Ask once per distinct set of unanswered files. Option 3 above — "this is
  // not a user-facing capability" — leaves the diff untouched, so without this
  // the hook would block that turn forever. Keyed by content, so adding a new
  // one-sided file is new information and does ask again. The marker lives in
  // the git dir: per-worktree, never committed, and wiped with the worktree.
  const marker = join(git('rev-parse', '--absolute-git-dir').trim() || '.git', 'reis-tree-parity');
  const fingerprint = [...sets.desktopOnly, ...sets.mobileOnly].sort().join('\n');
  try {
    if (readFileSync(marker, 'utf8') === fingerprint) ok();
    writeFileSync(marker, fingerprint);
  } catch {
    try {
      writeFileSync(marker, fingerprint);
    } catch {
      /* unwritable git dir: ask every turn rather than never */
    }
  }

  // Exit 2 is the documented way for a Stop hook to prevent stopping and feed
  // stderr back to Claude. Preferred over a JSON decision here because the
  // exit-code contract is the one the published reference states for Stop.
  process.stderr.write(reason + '\n');
  process.exit(2);
};

/**
 * Only act when executed as a hook. Importing this file (the guard test does)
 * must not read stdin or exit the process.
 *
 * Compared as real paths, not as URLs. A symlink anywhere in the invocation
 * path — /tmp -> /private/tmp on macOS, or a symlinked worktree — makes
 * argv[1] and import.meta.url disagree about the same file, and the naive
 * comparison then silently skips main(). A guard that quietly never runs is
 * worse than no guard, because it still reports success.
 */
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
export const isDirectRun = (argv1, moduleUrl) =>
  Boolean(argv1) && real(argv1) === real(fileURLToPath(moduleUrl));

if (isDirectRun(process.argv[1], import.meta.url)) main();
