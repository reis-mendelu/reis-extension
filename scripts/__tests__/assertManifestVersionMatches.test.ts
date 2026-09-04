import { describe, it, expect } from 'vitest';
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
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/5\.2\.0/);
    expect(result.reason).toMatch(/5\.1\.0/);
  });

  it('fails closed when the manifest version cannot be extracted at all', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ version: '5.1.0' }),
      wxtConfig: 'export default defineConfig({});',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Could not find manifest.version/);
  });

  it('fails closed when package.json has no version field', () => {
    const result = checkManifestVersionMatches({
      packageJson: JSON.stringify({ name: 'x' }),
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no version field/);
  });

  it('fails closed when package.json is not valid JSON', () => {
    const result = checkManifestVersionMatches({
      packageJson: '{not json',
      wxtConfig: WXT_CONFIG_FIXTURE,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not valid JSON/);
  });
});
