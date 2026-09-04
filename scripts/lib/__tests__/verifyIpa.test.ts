import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSafePath,
  assertUploadable,
  grepFiles,
  runCombined,
  type IpaFacts,
} from '../verifyIpa';

const good: IpaFacts = {
  authority: 'Apple Distribution: Dominik Holek (RG38V3SV8X)',
  bundleVersion: '50101.1',
  marketingVersion: '5.1.1',
  telemetryHits: [],
};

describe('assertUploadable', () => {
  it('passes a distribution-signed build at the expected version', () => {
    expect(() => assertUploadable(good, '50101.1')).not.toThrow();
  });

  it('rejects a development-signed build', () => {
    const facts = { ...good, authority: 'Apple Development: Dominik Holek (RG38V3SV8X)' };
    expect(() => assertUploadable(facts, '50101.1')).toThrow(/Apple Distribution/);
  });

  it('rejects an unsigned build', () => {
    expect(() => assertUploadable({ ...good, authority: null }, '50101.1')).toThrow(/nothing/);
  });

  it('rejects a build stamped with a version other than the one we picked', () => {
    // The stamp silently reverting is exactly how a duplicate build number
    // reached App Store Connect before.
    expect(() => assertUploadable({ ...good, bundleVersion: '50101' }, '50101.1')).toThrow(
      /CFBundleVersion is 50101, expected 50101\.1/
    );
  });

  it('rejects a build that still carries error telemetry', () => {
    const facts = { ...good, telemetryHits: ['Payload/App.app/public/assets/index-abc.js'] };
    expect(() => assertUploadable(facts, '50101.1')).toThrow(/telemetry/);
  });

  it('reports every problem at once rather than one per run', () => {
    const facts = { ...good, authority: null, bundleVersion: '50100', telemetryHits: ['x.js'] };
    try {
      assertUploadable(facts, '50101.1');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(String(err).split('\n  - ')).toHaveLength(4);
    }
  });
});

describe('runCombined', () => {
  it('returns stderr as well as stdout', () => {
    // The whole point: `codesign -dvvv` prints the Authority lines to stderr
    // and nothing to stdout, so a stdout-only read made every signed .ipa look
    // unsigned. This is that bug's regression test.
    const out = runCombined('sh', ['-c', 'echo on-stdout; echo on-stderr >&2']);
    expect(out).toContain('on-stdout');
    expect(out).toContain('on-stderr');
  });
});

describe('grepFiles', () => {
  it('finds the files that contain a needle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grep-'));
    writeFileSync(join(dir, 'bundle.js'), 'await supabase.rpc("report_error", {})');
    writeFileSync(join(dir, 'clean.js'), 'export const x = 1;');
    expect(grepFiles(dir, ['report_error', 'sendTelemetry'])).toEqual([join(dir, 'bundle.js')]);
  });

  it('returns nothing for a clean directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grep-'));
    writeFileSync(join(dir, 'clean.js'), 'export const x = 1;');
    expect(grepFiles(dir, ['report_error'])).toEqual([]);
  });

  it('throws when the scan itself fails rather than reporting a clean bundle', () => {
    // grep exits 2 here. Read as "no matches", it would let an unscanned
    // binary upload while the log said the bundle was clean.
    expect(() => grepFiles(join(tmpdir(), 'no-such-dir-9f3a'), ['report_error'])).toThrow(
      /NOT scanned/
    );
  });
});

describe('assertSafePath', () => {
  it('passes an absolute path through unchanged', () => {
    expect(assertSafePath('/var/folders/x/Payload/App.app')).toBe('/var/folders/x/Payload/App.app');
  });

  it('refuses a relative path, which a tool could read as an option', () => {
    expect(() => assertSafePath('-rf')).toThrow(/relative path/);
    expect(() => assertSafePath('Payload/App.app')).toThrow(/relative path/);
  });
});
