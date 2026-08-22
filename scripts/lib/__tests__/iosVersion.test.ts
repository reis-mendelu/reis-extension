import { describe, it, expect } from 'vitest';
import {
  deriveIosVersion,
  patchPbxproj,
  reconcileBundleVersion,
  readBundleVersion,
} from '../iosVersion';

describe('deriveIosVersion', () => {
  it('derives the same integer Android uses, so one number identifies a build on both stores', () => {
    expect(deriveIosVersion('5.0.6')).toEqual({
      marketingVersion: '5.0.6',
      bundleVersion: '50006',
    });
  });

  // Same whole-match rule as android/app/build.gradle: a prerelease cannot be
  // encoded into a distinct build number, so 5.0.6-beta would silently reuse
  // the number already spent on 5.0.6 and App Store Connect would reject it.
  it.each(['5.0.6-beta', '5.0.6+build.2', '5.0', 'v5.0.6', ''])(
    'refuses %s rather than loose-matching it',
    (bad) => {
      expect(() => deriveIosVersion(bad)).toThrow(/semver/i);
    }
  );

  it('refuses a minor or patch of 100, which would collide with the next component up', () => {
    // 5.0.100 and 5.1.0 both come to 50100.
    expect(() => deriveIosVersion('5.0.100')).toThrow(/collide/i);
    expect(() => deriveIosVersion('5.100.0')).toThrow(/collide/i);
  });

  // iOS-only concern, and the reason this is not just a copy of the Android
  // rule: CFBundleVersion must be unique and increasing WITHIN one
  // CFBundleShortVersionString train. Re-uploading a fixed build under the same
  // marketing version is routine on TestFlight, and would otherwise be rejected
  // as a duplicate. Apple allows up to three period-separated integers.
  it('appends a rebuild counter for a second upload of the same marketing version', () => {
    expect(deriveIosVersion('5.0.6', 2).bundleVersion).toBe('50006.2');
    expect(deriveIosVersion('5.0.6', '3').bundleVersion).toBe('50006.3');
  });

  it('leaves the marketing version untouched by a rebuild — testers see 5.0.6, not 5.0.6.2', () => {
    expect(deriveIosVersion('5.0.6', 2).marketingVersion).toBe('5.0.6');
  });

  it.each([0, -1, 1.5, 'x'])('refuses rebuild counter %s', (bad) => {
    expect(() => deriveIosVersion('5.0.6', bad as number)).toThrow(/rebuild/i);
  });
});

describe('patchPbxproj', () => {
  // Xcode repeats every build setting once per configuration (Debug/Release).
  // Patching only the first is the bug that ships a Release still on 1.0.
  const pbx = `
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = cz.reis.app;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = cz.reis.app;
`;

  it('rewrites every configuration, not just the first', () => {
    const out = patchPbxproj(pbx, { marketingVersion: '5.0.6', bundleVersion: '50006' });
    expect(out.match(/MARKETING_VERSION = 5\.0\.6;/g)).toHaveLength(2);
    expect(out.match(/CURRENT_PROJECT_VERSION = 50006;/g)).toHaveLength(2);
    expect(out).not.toMatch(/= 1\.0;/);
  });

  it('leaves unrelated settings alone', () => {
    const out = patchPbxproj(pbx, { marketingVersion: '5.0.6', bundleVersion: '50006' });
    expect(out.match(/PRODUCT_BUNDLE_IDENTIFIER = cz\.reis\.app;/g)).toHaveLength(2);
  });

  // The failure this guards is silent: if Xcode ever renames or reformats the
  // setting, a regex that matches nothing would leave the project on 1.0 and
  // the script would still exit 0.
  it.each(['MARKETING_VERSION', 'CURRENT_PROJECT_VERSION'])(
    'throws when %s is absent instead of quietly changing nothing',
    (key) => {
      const stripped = pbx.replace(new RegExp(`\\s*${key} = [^;]+;`, 'g'), '');
      expect(() =>
        patchPbxproj(stripped, { marketingVersion: '5.0.6', bundleVersion: '50006' })
      ).toThrow(new RegExp(key));
    }
  );
});

describe('reconcileBundleVersion', () => {
  // The bug this exists for: ios:version is wired into cap:sync, so a plain
  // `npm run cap:ios` re-runs it WITHOUT REIS_IOS_BUILD. Without reconciliation
  // that rewrote a stamped 50006.2 back to 50006, and App Store Connect
  // rejected the archive as a duplicate build — after the stamp had looked
  // like it worked.
  it('keeps a stamped rebuild when a later sync runs without the env var', () => {
    expect(reconcileBundleVersion('50006.2', '50006')).toBe('50006.2');
  });

  it('lets an explicit higher rebuild move forward', () => {
    expect(reconcileBundleVersion('50006.2', '50006.3')).toBe('50006.3');
  });

  it('refuses to move backwards within one marketing version', () => {
    expect(reconcileBundleVersion('50006.3', '50006.1')).toBe('50006.3');
  });

  // A new marketing version starts a fresh CFBundleVersion train, so the
  // counter from the previous one must NOT be carried over.
  it('resets on a version bump rather than inheriting the old counter', () => {
    expect(reconcileBundleVersion('50006.4', '50007')).toBe('50007');
  });

  it('replaces the Capacitor template default', () => {
    expect(reconcileBundleVersion('1', '50006')).toBe('50006');
  });

  it('starts fresh when the project has no readable value', () => {
    expect(reconcileBundleVersion(null, '50006')).toBe('50006');
    expect(reconcileBundleVersion('not-a-number', '50006')).toBe('50006');
  });
});

describe('readBundleVersion', () => {
  it('reads the value Xcode currently holds', () => {
    expect(readBundleVersion('\t\tCURRENT_PROJECT_VERSION = 50006.2;\n')).toBe('50006.2');
  });

  it('returns null when the setting is absent', () => {
    expect(readBundleVersion('MARKETING_VERSION = 5.0.6;')).toBeNull();
  });
});
