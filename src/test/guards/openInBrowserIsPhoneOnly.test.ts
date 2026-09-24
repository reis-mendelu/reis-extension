import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROWSING_TOOLBAR } from '../../mobile/openInBrowser';

/**
 * "Open in browser", reload and Android back-through-history exist in the
 * iOS/Android apps ONLY.
 *
 * They are toolbar buttons on the in-app WebView that the apps open IS pages
 * in (mobile/openInBrowser.ts, wired in mobile/openExternal.ts). The extension
 * has no such WebView: off Capacitor openExternal is a plain `window.open`, so
 * an IS link already lands in a real browser tab, which has its own address
 * bar, reload and back. There is nothing on the desktop tree to add them to.
 *
 * openExternal.ts is shared code that branches internally, which is exactly
 * how a one-platform feature hides (CLAUDE.md, "Two traps"). Both halves are
 * pinned: the phone keeps the toolbar, the extension keeps `window.open`, and
 * the launcher plugin never reaches a bundle the extension loads eagerly.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

function sourcesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), 'src', dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(resolve(abs, name)).isDirectory()) return sourcesUnder(rel);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

describe('open in browser placement', () => {
  it('the phone opens IS pages with the browsing toolbar', () => {
    const src = read('mobile/openExternal.ts');
    expect(src).toContain('...BROWSING_TOOLBAR');
    expect(src).toContain('armOpenInBrowser(');
  });

  it('the extension keeps a plain browser tab, and decides that before any toolbar code runs', () => {
    const src = read('mobile/openExternal.ts');
    const tab = src.indexOf("window.open(target, '_blank', 'noopener,noreferrer')");
    expect(tab).toBeGreaterThan(-1);
    expect(tab).toBeLessThan(src.indexOf('armOpenInBrowser('));
  });

  it('loads the launcher plugin lazily, and only from the phone code', () => {
    const importers = sourcesUnder('.').filter((f) =>
      read(f).includes("'@capacitor/app-launcher'")
    );
    expect(importers).toEqual(['mobile/openInBrowser.ts']);
    // A static import would put the plugin into every bundle that reaches
    // openExternal, the extension's included.
    expect(read('mobile/openInBrowser.ts')).not.toMatch(/^import .*@capacitor\/app-launcher/m);
  });

  it("ships the Android icon the button names, since a missing one rejects every IS link's open", () => {
    const drawable = resolve(
      process.cwd(),
      'android/app/src/main/res/drawable',
      `${BROWSING_TOOLBAR.buttonNearDone.android.icon}.xml`
    );
    expect(existsSync(drawable)).toBe(true);
  });
});
