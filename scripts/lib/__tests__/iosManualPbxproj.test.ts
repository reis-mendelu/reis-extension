import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withManualSigning } from '../iosManualPbxproj';

const pbxproj = readFileSync(
  resolve(__dirname, '../../../ios/App/App.xcodeproj/project.pbxproj'),
  'utf8'
);

describe('withManualSigning', () => {
  const out = withManualSigning(pbxproj, 'cz.reis.app', 'reIS CI App Store');

  it('makes the app target Release manual with the profile and distribution identity', () => {
    expect(out).toContain('PROVISIONING_PROFILE_SPECIFIER = "reIS CI App Store";');
    expect(out).toContain('CODE_SIGN_IDENTITY = "Apple Distribution";');
    expect(out.match(/CODE_SIGN_STYLE = Manual;/g)).toHaveLength(1);
  });

  it('leaves the Debug configuration and everything else alone', () => {
    expect(out.match(/CODE_SIGN_STYLE = Automatic;/g)).toHaveLength(1);
    expect(out.length - pbxproj.length).toBeLessThan(200);
  });

  it('refuses a project it cannot patch exactly once', () => {
    expect(() => withManualSigning(pbxproj, 'com.other.app', 'x')).toThrow(/exactly one/);
  });
});
