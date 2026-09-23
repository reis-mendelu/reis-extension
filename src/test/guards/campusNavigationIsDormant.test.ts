import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPUS_NAVIGATION_ENABLED } from '../../utils/routing/navigationEnabled';

/**
 * Campus navigation is parked, and the location permission is out of every
 * store binary. That second half is why this guard exists.
 *
 * A location permission is something the App Store, Play and the Chrome Web
 * Store all review separately, and the review is longer for it. The feature is
 * not in use yet, so asking for that review buys nothing. The published privacy
 * policy (docs/privacy-policy-app.md) also says neither app requests location.
 *
 * The router, the path graph and the route UI all stay in the tree. What goes
 * is the bridge to the device's position: the Capacitor plugin and the two
 * native permission declarations. Without the plugin the binary contains no
 * code that could raise the prompt, whatever the UI does.
 *
 * To bring it back, in this order: `npm i @capacitor/geolocation`, restore
 * `currentPosition` in src/utils/routing/position.ts (the commit that parked it
 * says which one had the real body), put ACCESS_COARSE/FINE_LOCATION back in
 * AndroidManifest.xml and NSLocationWhenInUseUsageDescription back in
 * Info.plist, update the privacy policy and the gist, flip the flag, and
 * change this guard to match.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf-8');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe('campus navigation is dormant', () => {
  it('is switched off', () => {
    expect(CAMPUS_NAVIGATION_ENABLED).toBe(false);
  });

  it('ships no geolocation plugin', () => {
    const pkg = JSON.parse(read('package.json')) as Record<string, Record<string, string>>;
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all)).not.toContain('@capacitor/geolocation');
    expect(read('android/capacitor.settings.gradle')).not.toMatch(/geolocation/i);
    expect(read('android/app/capacitor.build.gradle')).not.toMatch(/geolocation/i);
    expect(read('ios/App/CapApp-SPM/Package.swift')).not.toMatch(/Geolocation/);
  });

  it('declares no location permission on Android', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).not.toMatch(/ACCESS_\w*_LOCATION/);
    expect(manifest).not.toMatch(/hardware\.location/);
  });

  it('declares no location purpose string on iOS', () => {
    expect(read('ios/App/App/Info.plist')).not.toMatch(/NSLocation/);
  });

  it('asks the browser for no location either', () => {
    // The extension never did; this keeps it that way.
    expect(read('wxt.config.ts')).not.toMatch(/geolocation/);
  });

  it('has no source that imports the plugin', () => {
    const offenders = sources(join(root, 'src')).filter((f) =>
      /(from|import\()\s*['"]@capacitor\/geolocation['"]/.test(readFileSync(f, 'utf-8'))
    );
    expect(offenders).toEqual([]);
  });
});
