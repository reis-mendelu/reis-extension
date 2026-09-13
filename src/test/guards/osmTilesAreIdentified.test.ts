import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every build must identify itself to OpenStreetMap's tile servers.
 *
 * OSM's tile usage policy blocks traffic it cannot attribute to a particular
 * app or site, and the block is total and silent: every tile comes back as a
 * 403 "App is not following the tile usage policy" image, so the campus map
 * renders as a wall of error tiles with the overlays floating on top. It is the
 * general block (403), not the "Referer is required" one (403r) — the fix is
 * identification, not a referrer policy.
 *
 * Identification is per-platform because the two shells send different things:
 *
 *  - Capacitor (iOS/Android) is a native shell, so it appends a name + contact
 *    URL to the WebView User-Agent. This has always been here and is why the
 *    map works on a phone.
 *  - The browser extension serves the app from a `chrome-extension://` iframe.
 *    Chrome and Firefox strip an extension origin from `Referer`, and page JS
 *    cannot touch `User-Agent` (it is a forbidden header for both `fetch` and
 *    `<img>`), so the tile requests arrived anonymous and got blocked. The only
 *    lever an extension has is a declarativeNetRequest rule appending the SAME
 *    identifier the native shell sends.
 *
 * Losing either half blanks the map for that platform, with no error anywhere
 * except the tiles themselves. This guard is what makes that loud.
 */

const root = process.cwd();
const CONTACT = 'github.com/reis-mendelu/reis-extension';
const RULES = 'public/osm-tile-identity.rules.json';

describe('OSM tile requests are identified on every platform', () => {
  it('appends a contactable User-Agent in the Capacitor shell', () => {
    const cfg = readFileSync(join(root, 'capacitor.config.ts'), 'utf-8');
    expect(cfg).toMatch(/appendUserAgent:\s*'reIS\//);
    expect(cfg).toContain(CONTACT);
  });

  it('ships a declarativeNetRequest ruleset that appends the same identifier', () => {
    const path = join(root, RULES);
    expect(existsSync(path), `${RULES} is missing`).toBe(true);
    const rules = JSON.parse(readFileSync(path, 'utf-8')) as Array<{
      action: {
        type: string;
        requestHeaders?: Array<{ header: string; operation: string; value?: string }>;
      };
      condition: { urlFilter?: string; resourceTypes?: string[] };
    }>;

    const rule = rules.find((r) => r.condition.urlFilter?.includes('tile.openstreetmap.org'));
    expect(rule, 'no rule targets tile.openstreetmap.org').toBeDefined();
    expect(rule!.action.type).toBe('modifyHeaders');

    const ua = rule!.action.requestHeaders?.find((h) => h.header === 'user-agent');
    expect(ua, 'no user-agent header modification').toBeDefined();
    // Chrome's append allowlist is CASE SENSITIVE (crbug 449152902): spelled
    // "User-Agent" the rule is rejected at load and the map silently stays
    // blocked.
    expect(ua!.header).toBe('user-agent');
    // Append, never set: the platform half of the UA has to stay truthful, and
    // OSM rejects spoofed identification outright.
    expect(ua!.operation).toBe('append');
    expect(ua!.value).toContain(CONTACT);
    // Chrome inserts the separator for an append itself (measured: a leading
    // space here produced "Safari/537.36  reIS/5 ..." with two spaces), so the
    // value must carry none of its own.
    expect(ua!.value).toBe(ua!.value!.trim());
    expect(rule!.condition.resourceTypes).toContain('image');
  });

  it('declares the permissions the ruleset needs to take effect', () => {
    const cfg = readFileSync(join(root, 'wxt.config.ts'), 'utf-8');
    // modifyHeaders is ignored without a host permission for the request.
    expect(cfg).toContain('https://tile.openstreetmap.org/*');
    expect(cfg).toContain('declarativeNetRequest');
    expect(cfg).toContain(RULES.replace('public/', ''));
    // ...and only on MV3. The Firefox build is MV2, which has no
    // declarativeNetRequest at all, so un-gating this would put an unknown
    // permission string in front of an AMO reviewer and buy nothing.
    expect(cfg).toContain('manifestVersion === 3');
  });
});
