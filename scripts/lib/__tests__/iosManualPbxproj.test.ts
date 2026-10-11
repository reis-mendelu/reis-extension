import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withManualSigning } from '../iosManualPbxproj';

const pbxproj = readFileSync(
  resolve(__dirname, '../../../ios/App/App.xcodeproj/project.pbxproj'),
  'utf8'
);

/** The app target's build configuration of that name. */
function appConfig(text: string, name: 'Debug' | 'Release'): string {
  const blocks = text.match(
    new RegExp(`\\t\\t[0-9A-F]{24} \\/\\* ${name} \\*\\/ = \\{[\\s\\S]*?\\n\\t\\t\\};`, 'g')
  );
  const mine = (blocks ?? []).filter((b) => b.includes('PRODUCT_BUNDLE_IDENTIFIER = cz.reis.app;'));
  expect(mine).toHaveLength(1);
  return mine[0] as string;
}

describe('withManualSigning', () => {
  const out = withManualSigning(pbxproj, 'cz.reis.app', 'reIS CI App Store');

  it("makes the app target's Release manual with the profile and distribution identity", () => {
    const release = appConfig(out, 'Release');
    expect(release).toContain('CODE_SIGN_STYLE = Manual;');
    expect(release).toContain('CODE_SIGN_IDENTITY = "Apple Distribution";');
    expect(release).toContain('PROVISIONING_PROFILE_SPECIFIER = "reIS CI App Store";');
    expect(release).not.toContain('CODE_SIGN_STYLE = Automatic;');
  });

  it('leaves the app target Debug configuration untouched', () => {
    expect(appConfig(out, 'Debug')).toBe(appConfig(pbxproj, 'Debug'));
  });

  it('changes nothing outside that one block', () => {
    expect(out.replace(appConfig(out, 'Release'), appConfig(pbxproj, 'Release'))).toBe(pbxproj);
  });

  it('refuses a project it cannot patch exactly once', () => {
    expect(() => withManualSigning(pbxproj, 'com.other.app', 'x')).toThrow(/exactly one/);
  });
});
