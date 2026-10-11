import { describe, expect, it } from 'vitest';
import { manualExportOptionsPlist } from '../iosManualExport';

describe('manualExportOptionsPlist', () => {
  const plist = manualExportOptionsPlist('RG38V3SV8X', 'cz.reis.app', 'iOS Team Store Profile');

  it('signs manually with the given profile for the bundle id', () => {
    expect(plist).toContain('<key>signingStyle</key>\n\t<string>manual</string>');
    expect(plist).toContain('<key>cz.reis.app</key>\n\t\t<string>iOS Team Store Profile</string>');
    expect(plist).toContain('<key>signingCertificate</key>\n\t<string>Apple Distribution</string>');
  });

  it('still exports without uploading, for the App Store', () => {
    expect(plist).toContain('<key>destination</key>\n\t<string>export</string>');
    expect(plist).toContain('<string>app-store-connect</string>');
  });
});
