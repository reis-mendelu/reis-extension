import { describe, expect, it } from 'vitest';
import {
  ascJwtClaims,
  exportOptionsPlist,
  nextBundleVersion,
  parseReleaseArgs,
  parseSigningAuthority,
} from '../iosRelease';

describe('nextBundleVersion', () => {
  it('uses the bare derived number when App Store Connect has no build for it', () => {
    expect(nextBundleVersion('50101', [])).toBe('50101');
  });

  it('adds the first counter when the bare number is already taken', () => {
    expect(nextBundleVersion('50101', ['50101'])).toBe('50101.1');
  });

  it('continues from the highest counter, not the count of builds', () => {
    // 50101.2 deleted from ASC would make a count-based scheme reuse it.
    expect(nextBundleVersion('50101', ['50101', '50101.1', '50101.3'])).toBe('50101.4');
  });

  it('ignores builds from other marketing trains', () => {
    expect(nextBundleVersion('50101', ['50100', '50100.7', '50006'])).toBe('50101');
  });

  it('ignores unparseable build strings rather than throwing away the release', () => {
    expect(nextBundleVersion('50101', ['50101', 'not-a-version', '50101.2'])).toBe('50101.3');
  });

  it('refuses a base that is not a plain integer', () => {
    expect(() => nextBundleVersion('50101.1', [])).toThrow(/plain integer/i);
  });
});

describe('exportOptionsPlist', () => {
  it('exports for the App Store without uploading', () => {
    const plist = exportOptionsPlist('RG38V3SV8X');
    expect(plist).toContain('<key>method</key>\n\t<string>app-store-connect</string>');
    // `destination upload` is what fails on this Mac with "Failed to Use
    // Accounts" — the upload is a separate altool step on purpose.
    expect(plist).toContain('<key>destination</key>\n\t<string>export</string>');
    expect(plist).toContain('<string>RG38V3SV8X</string>');
    expect(plist).toContain('<key>signingStyle</key>\n\t<string>automatic</string>');
  });
});

describe('parseSigningAuthority', () => {
  it('reads the first Authority line from codesign -dvvv output', () => {
    const out = [
      'Executable=/tmp/Payload/App.app/App',
      'Authority=Apple Distribution: Dominik Holek (RG38V3SV8X)',
      'Authority=Apple Worldwide Developer Relations Certification Authority',
      'Authority=Apple Root CA',
    ].join('\n');
    expect(parseSigningAuthority(out)).toBe('Apple Distribution: Dominik Holek (RG38V3SV8X)');
  });

  it('returns null when nothing signed it', () => {
    expect(parseSigningAuthority('code object is not signed at all')).toBeNull();
  });
});

describe('ascJwtClaims', () => {
  it('is scoped to the App Store Connect audience and expires inside Apple 20-minute cap', () => {
    const now = 1_770_000_000_000;
    const claims = ascJwtClaims('69a6de70-1111-2222-3333-444455556666', now);
    expect(claims.iss).toBe('69a6de70-1111-2222-3333-444455556666');
    expect(claims.aud).toBe('appstoreconnect-v1');
    expect(claims.iat).toBe(1_770_000_000);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(20 * 60);
    expect(claims.exp - claims.iat).toBeGreaterThan(0);
  });
});

describe('parseReleaseArgs', () => {
  it('reads a tag and the skip-upload flag in any order', () => {
    expect(parseReleaseArgs(['--skip-upload', '--tag', 'v5.1.1'])).toEqual({
      tag: 'v5.1.1',
      skipUpload: true,
    });
    expect(parseReleaseArgs([])).toEqual({ tag: undefined, skipUpload: false });
  });

  it('refuses --tag with no value instead of silently releasing HEAD', () => {
    // `npm run release:ios -- --tag` (a typo, or a shell that ate the value)
    // must not become the untagged mode and upload an unintended commit.
    expect(() => parseReleaseArgs(['--tag'])).toThrow(/--tag needs a value/);
    expect(() => parseReleaseArgs(['--tag', '--skip-upload'])).toThrow(/--tag needs a value/);
  });

  it('refuses an argument it does not understand', () => {
    expect(() => parseReleaseArgs(['--upload-now'])).toThrow(/Unknown argument/);
  });
});
