import { describe, expect, it } from 'vitest';
import { assertUploadable, type IpaFacts } from '../verifyIpa';

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
