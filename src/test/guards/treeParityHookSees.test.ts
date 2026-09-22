import { existsSync, readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The tree-parity Stop hook (`.claude/hooks/tree-parity.mjs`) is what stops a
 * feature shipping on one UI tree and not the other. It classifies changed
 * files by walking each tree's import closure from a hardcoded entry point.
 *
 * Rename an entry point and the closure collapses; the hook then exits 0 on
 * every turn and a silent guard is indistinguishable from a passing one. This
 * test is the thing that notices. It imports the hook's real classifier rather
 * than a copy, so the logic under test is the logic that runs.
 *
 * The specifier is a runtime URL, not a literal: `tsconfig.app.json` has no
 * `allowJs` and includes only `src`, so a static import of the .mjs would not
 * typecheck. It is built from cwd rather than `import.meta.url`, which under
 * vitest is an http: URL the ESM loader refuses.
 */
const HOOK = '.claude/hooks/tree-parity.mjs';
const hookUrl = pathToFileURL(resolve(HOOK)).href;

type Hook = {
  MOBILE_ENTRY: string[];
  DESKTOP_ENTRY: string[];
  closure: (entries: string[]) => Set<string>;
  classify: (
    changed: Iterable<string>,
    mobile: Set<string>,
    desktop: Set<string>,
    pinnedText?: string
  ) => { desktopOnly: string[]; mobileOnly: string[] };
  buildReason: (sets: { desktopOnly: string[]; mobileOnly: string[] }) => string | null;
  isDirectRun: (argv1: string | undefined, moduleUrl: string) => boolean;
};

const hook: Hook = await import(/* @vite-ignore */ hookUrl);
const mobile = hook.closure(hook.MOBILE_ENTRY);
const desktop = hook.closure(hook.DESKTOP_ENTRY);

describe('tree-parity hook can still tell the two UI trees apart', () => {
  it('the hook file itself is where settings.json points', () => {
    expect(existsSync(HOOK)).toBe(true);
  });

  it.each([...hook.MOBILE_ENTRY, ...hook.DESKTOP_ENTRY])('entry point %s exists', (entry) => {
    expect(
      existsSync(entry),
      `${entry} was renamed or moved — update the hook's entry points`
    ).toBe(true);
  });

  it('resolves a real tree from each entry point', () => {
    // Not an arbitrary floor: each tree reached >500 modules when the hook was
    // written. Anything in the low tens means resolution broke, not that the
    // app shrank.
    expect(mobile.size).toBeGreaterThan(100);
    expect(desktop.size).toBeGreaterThan(100);
  });

  it('classifies a desktop-only, a mobile-only and a shared file correctly', () => {
    // MapHoverCard is hover, which touch does not have. MobileApp's shell is
    // the phone. CampusMap/MapCanvas is the map both trees render — the file
    // that makes path-based classification wrong.
    const desktopOnly = 'src/components/MapHoverCard.tsx';
    const mobileOnly = 'src/components/mobile/MobileApp.tsx';
    const shared = 'src/components/CampusMap/MapCanvas.tsx';
    for (const f of [desktopOnly, mobileOnly, shared]) expect(existsSync(f)).toBe(true);

    expect(hook.classify([desktopOnly], mobile, desktop)).toEqual({
      desktopOnly: [desktopOnly],
      mobileOnly: [],
    });
    expect(hook.classify([mobileOnly], mobile, desktop)).toEqual({
      desktopOnly: [],
      mobileOnly: [mobileOnly],
    });
    expect(hook.classify([shared], mobile, desktop)).toEqual({ desktopOnly: [], mobileOnly: [] });
  });

  it('asks about the other tree only when exactly one tree was touched', () => {
    expect(hook.buildReason({ desktopOnly: ['a.tsx'], mobileOnly: [] })).toContain('DESKTOP tree');
    expect(hook.buildReason({ desktopOnly: [], mobileOnly: ['b.tsx'] })).toContain('PHONE/iPad');
    expect(hook.buildReason({ desktopOnly: ['a.tsx'], mobileOnly: ['b.tsx'] })).toBeNull();
    expect(hook.buildReason({ desktopOnly: [], mobileOnly: [] })).toBeNull();
  });

  it('a guard clears only the files it names, not the whole turn', () => {
    // The blanket version of this escape hatch hid a second forgotten
    // capability whenever any guard file happened to be touched.
    const pinned = 'src/components/MapHoverCard.tsx';
    const forgotten = 'src/components/SubjectFileDrawer/Header/CourseMeta.tsx';
    for (const f of [pinned, forgotten]) expect(existsSync(f)).toBe(true);
    // Guards name files the way desktopHasNoShowOnMap.test.ts does: src-relative.
    const guardText = `// ${pinned.replace(/^src\//, '')} is hover-only; touch has no hover.`;

    expect(hook.classify([pinned], mobile, desktop, guardText).desktopOnly).toEqual([]);
    expect(hook.classify([pinned, forgotten], mobile, desktop, guardText).desktopOnly).toEqual([
      forgotten,
    ]);
  });

  it('still recognises itself as directly run through a symlinked path', () => {
    // /tmp -> /private/tmp on macOS. Comparing URLs instead of real paths made
    // the hook exit 0 without running, which looks exactly like a pass.
    const real = resolve(HOOK);
    expect(hook.isDirectRun(real, pathToFileURL(real).href)).toBe(true);

    // A REAL symlink, not two made-up /tmp paths: realpathSync only resolves
    // paths that exist, so a fabricated pair proves nothing about the macOS
    // /tmp -> /private/tmp case this exists to survive.
    const dir = mkdtempSync(join(tmpdir(), 'reis-parity-'));
    const link = join(dir, 'hook.mjs');
    symlinkSync(real, link);
    try {
      expect(hook.isDirectRun(link, pathToFileURL(real).href)).toBe(true);
    } finally {
      rmSync(dirname(link), { recursive: true, force: true });
    }

    expect(hook.isDirectRun(undefined, pathToFileURL(real).href)).toBe(false);
    expect(hook.isDirectRun('/some/other/file.mjs', pathToFileURL(real).href)).toBe(false);
  });

  it('is registered as a Stop hook, not PreToolUse', () => {
    // PreToolUse would fire on every feature's first edit, since that edit is
    // always single-tree. The whole design depends on running at end of turn.
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8')) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const commands = (settings.hooks['Stop'] ?? []).flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('tree-parity.mjs'))).toBe(true);
  });
});
