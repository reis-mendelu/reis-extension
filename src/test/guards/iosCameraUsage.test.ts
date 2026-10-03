import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

/**
 * NSCameraUsageDescription has TWO reasons now, and an iOS app that opens the
 * camera without the key is terminated on the spot — no prompt, no error.
 *
 * 1. The report form's screenshot picker is an `<input type="file" accept="image/*">`
 *    on the SHARED tree, so it reaches the iPhone and iPad app, and WKWebView
 *    offers "Take Photo" for that input.
 * 2. The iPad ink reader's `+` menu offers "Take photo" to put a picture on a
 *    page of the student's notes (October 2026). The photo stays on the iPad.
 *
 * Removing one of them does not free the key while the other ships. The plist
 * string and the privacy policy's iOS line name both, and are pinned here.
 */
describe('iOS camera usage string', () => {
  it('is present while an image picker ships on the phone tree', () => {
    expect(read('src/components/Feedback/ReportAttachments.tsx')).toMatch(/accept="image\/\*"/);
    expect(read('ios/App/App/Info.plist')).toMatch(/<key>NSCameraUsageDescription<\/key>/);
  });

  it('is present while the iPad ink reader can take a photo for a page', () => {
    expect(
      read('native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift')
    ).toMatch(/sourceType = \.camera/);
    expect(read('ios/App/App/Info.plist')).toMatch(
      /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*problem report[^<]*iPad[^<]*<\/string>/
    );
  });

  it('is disclosed in the app privacy policy, for both reasons', () => {
    const policy = read('docs/privacy-policy-app.md');
    const ios = policy.slice(
      policy.indexOf('**iOS:**'),
      policy.indexOf('\n\n', policy.indexOf('**iOS:**'))
    );
    expect(ios).toMatch(/camera/i);
    expect(ios).toMatch(/problem\s+report/);
    expect(ios).toMatch(/iPad[\s\S]*notes/);
  });
});
