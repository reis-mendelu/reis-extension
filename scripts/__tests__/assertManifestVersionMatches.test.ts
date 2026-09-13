import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  extractManifestVersion,
  checkManifestVersionMatches,
} from '../assert-manifest-version-matches.mjs';

const WXT_CONFIG_FIXTURE = `
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'reIS',
    version: '5.1.0',
    description: 'test',
    icons: {
      16: 'reIS_logo_16.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'reis-extension@mendelu.cz',
      },
    },
  },
});
`;

describe('extractManifestVersion', () => {
  it('reads the version field out of the manifest object', () => {
    expect(extractManifestVersion(WXT_CONFIG_FIXTURE)).toBe('5.1.0');
  });

  it('is not confused by a version-shaped field outside the manifest object', () => {
    const source = `
      export default defineConfig({
        vite: { version: '9.9.9' },
        manifest: { name: 'x', version: '1.2.3' },
      });
    `;
    expect(extractManifestVersion(source)).toBe('1.2.3');
  });

  it('is not confused by nested objects inside manifest that close before version appears', () => {
    const source = `
      export default defineConfig({
        manifest: {
          icons: { 16: 'a.png' },
          name: 'x',
          version: '2.0.0',
        },
      });
    `;
    expect(extractManifestVersion(source)).toBe('2.0.0');
  });

  it('returns null when there is no manifest object', () => {
    expect(extractManifestVersion('export default defineConfig({});')).toBeNull();
  });

  it('returns null when manifest has no version field', () => {
    const source = `export default defineConfig({ manifest: { name: 'x' } });`;
    expect(extractManifestVersion(source)).toBeNull();
  });
});

describe('checkManifestVersionMatches', () => {
  it('passes when package.json and the manifest agree', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ version: '5.1.0' }),
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    expect(result).toEqual({ ok: true, version: '5.1.0' });
  });

  it('fails when package.json and the manifest disagree', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ version: '5.2.0' }),
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    if (result.ok) throw new Error('expected checkManifestVersionMatches to fail');
    expect(result.reason).toMatch(/5\.2\.0/);
    expect(result.reason).toMatch(/5\.1\.0/);
  });

  it('fails closed when the manifest version cannot be extracted at all', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ version: '5.1.0' }),
      wxtConfig: 'export default defineConfig({});',
    });
    if (result.ok) throw new Error('expected checkManifestVersionMatches to fail');
    expect(result.reason).toMatch(/Could not find manifest.version/);
  });

  it('fails closed when package.json has no version field', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ name: 'x' }),
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    if (result.ok) throw new Error('expected checkManifestVersionMatches to fail');
    expect(result.reason).toMatch(/no version field/);
  });

  it('fails closed when package.json is not valid JSON', () => {
    const result = checkManifestVersionMatches({
      packageJson: '{not json',
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    if (result.ok) throw new Error('expected checkManifestVersionMatches to fail');
    expect(result.reason).toMatch(/not valid JSON/);
  });
});

/**
 * The fixtures above prove the extractor works on well-shaped input. They do
 * NOT prove it can read THIS repo's wxt.config.ts — and that is the failure
 * that actually happens, because `assert-manifest-version-matches.mjs` runs
 * only in release-tag.yml, i.e. AFTER the release PR has merged into `main`.
 *
 * It has now bitten twice in one release. First `manifest` was refactored into
 * an arrow function, which the extractor cannot parse. Then the comment
 * explaining that regression itself contained the manifest key followed by an
 * open brace, and since the regex takes the FIRST match in the file, comments
 * included, it captured the comment instead of the real object.
 *
 * Both times the build was fine and every PR check was green; the tag job
 * failed after the merge, stranding a version number in `main` that was never
 * tagged or shipped. This test moves that failure back to PR time.
 */
describe('the real repository files', () => {
  it('can still be read by the release tag guard', () => {
    const result = checkManifestVersionMatches({
      packageJson: readFileSync('package.json', 'utf8'),
      wxtConfig: readFileSync('wxt.config.ts', 'utf8'),
    });
    expect(result.ok ? null : result.reason).toBeNull();
  });
});
