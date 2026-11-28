import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Old IS pages are restyled for a PHONE only (decided 2026-11-27).
 *
 * The phone opens IS pages in an in-app WebView and sends a stylesheet with
 * them (mobile/isPhoneFrame.ts, mobile/isPhoneFrameCss.ts, wired in
 * mobile/openExternal.ts), because a phone shrinks a desktop IS page to about a
 * quarter of its size.
 *
 * - The EXTENSION does not get it. It shows IS in a desktop browser tab, where
 *   the page already fits, and off Capacitor openExternal is a plain
 *   `window.open` with no page to inject into.
 * - The iPAD does not get it. It runs the phone tree, but IS's desktop layout
 *   fits a tablet; the script stops at a shorter side of 600, below every iPad
 *   (the mini is 744).
 *
 * openExternal.ts is shared code that branches internally, which is how a
 * one-platform feature hides (CLAUDE.md, "Two traps"). Both halves are pinned.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

function sourcesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), 'src', dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    // Test helpers live beside the tests and never reach a bundle.
    if (statSync(resolve(abs, name)).isDirectory())
      return name === '__tests__' ? [] : sourcesUnder(rel);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

describe('IS phone frame placement', () => {
  it('the phone sends the frame script with every IS page it opens', () => {
    const src = read('mobile/openExternal.ts');
    expect(src).toContain('buildPhoneFrameScript()');
    expect(src).toContain("preShowScriptInjectionTime: 'documentStart'");
  });

  it('the extension opens its plain browser tab before any of that runs', () => {
    const src = read('mobile/openExternal.ts');
    const tab = src.indexOf("window.open(target, '_blank', 'noopener,noreferrer')");
    expect(tab).toBeGreaterThan(-1);
    expect(tab).toBeLessThan(src.indexOf('buildPhoneFrameScript'));
  });

  it('is loaded lazily, and only by the opener, so the stylesheet stays out of the extension', () => {
    const importers = sourcesUnder('.').filter((f) =>
      /['"]\.{1,2}\/[^'"]*isPhoneFrame['"]/.test(read(f))
    );
    expect(importers).toEqual(['mobile/openExternal.ts']);
    expect(read('mobile/openExternal.ts')).not.toMatch(/^import .*isPhoneFrame/m);
    expect(read('mobile/openExternal.ts')).toContain("await import('./isPhoneFrame')");
  });

  it('stops below tablet size, so the iPad keeps the desktop layout', () => {
    const src = read('mobile/isPhoneFrame.ts');
    expect(src).toContain('const TABLET_MIN_SIDE = 600');
    expect(src).toContain('Math.min(screen.width,screen.height)>=${TABLET_MIN_SIDE}');
  });

  it('keeps the table script out of everything but the frame script', () => {
    const users = sourcesUnder('.').filter((f) => read(f).includes('PHONE_TABLES_JS'));
    expect(users.sort()).toEqual(['mobile/isPhoneFrame.ts', 'mobile/isPhoneTablesScript.ts']);
  });

  it('keeps every IS style in the one file the CLAUDE.md exception names', () => {
    const styled = sourcesUnder('.').filter((f) => read(f).includes('IS_PHONE_FRAME_CSS'));
    expect(styled.sort()).toEqual(['mobile/isPhoneFrame.ts', 'mobile/isPhoneFrameCss.ts']);
  });
});
