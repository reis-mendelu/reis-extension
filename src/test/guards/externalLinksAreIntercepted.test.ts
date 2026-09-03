import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `installExternalLinkHandler` has to actually be installed.
 *
 * This guard exists because of a shipped bug that every unit test missed. The
 * handler was written, documented, and covered from six angles in
 * `src/mobile/__tests__/openExternal.test.ts` — and no entrypoint ever called
 * it. On Capacitor a `target="_blank"` anchor does nothing at all on its own:
 * there is no browser chrome to open a tab in and no default `window.open`
 * behaviour to fall back on. So every such link in the app was simply inert.
 *
 * Reported as "clicking on an item in vyveska doesn't open it (also the
 * external click there does nothing)" — both the post links and the header's
 * external-link button, which is exactly the set of anchors this handler is
 * responsible for.
 *
 * The failure is invisible to component tests, because a test that installs the
 * handler itself proves only that the handler works. What was missing was the
 * one line wiring it to the app, and only a check on the entrypoint can see
 * that. Same shape as `nativePluginsAreReachable`: the unit is fine, the wiring
 * is what shipped broken.
 */

const root = process.cwd();
const MAIN = 'src/entrypoints/main/main.tsx';

describe('external links are intercepted', () => {
  it('installs the handler from the app entrypoint', () => {
    const src = readFileSync(join(root, MAIN), 'utf8');
    expect(
      /installExternalLinkHandler\s*\(/.test(src),
      `${MAIN} must call installExternalLinkHandler(). Without it every ` +
        `target="_blank" anchor in the app is inert on Capacitor — there is no ` +
        `tab for the WebView to open — and taps on the vývěska, the ` +
        `notifications and the document links all look dead.`
    ).toBe(true);
  });

  it('imports it from the module that defines it', () => {
    // A call with no import would not compile, but naming the source here is
    // what stops the check passing on a same-named local helper.
    const src = readFileSync(join(root, MAIN), 'utf8');
    expect(src).toMatch(
      /import\s*\{[^}]*installExternalLinkHandler[^}]*\}\s*from\s*['"][^'"]*openExternal['"]/
    );
  });

  it('installs it at module scope, not inside a component', () => {
    // The anchors it covers live in portals mounted outside the React tree
    // (MobileBulletinOverlay portals to document.body), and one of them is the
    // first thing a student can tap. A listener attached from an effect deep in
    // the tree would miss whatever mounts before it.
    //
    // Indentation is the check, because it is the thing that distinguishes the
    // two: a statement at column 0 runs on import, and anything nested in a
    // component, effect or callback cannot be.
    const src = readFileSync(join(root, MAIN), 'utf8');
    const call = src
      .split('\n')
      .find((l) => /installExternalLinkHandler\s*\(/.test(l) && !/^import/.test(l));
    expect(call, 'no call found outside the import line').toBeDefined();
    expect(call, `must be a top-level statement, found: ${JSON.stringify(call)}`).toMatch(
      /^installExternalLinkHandler\(/
    );
  });
});
