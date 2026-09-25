import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

/**
 * The report form's screenshot picker is an `<input type="file" accept="image/*">`
 * on the SHARED tree, so it reaches the iPhone and iPad app. WKWebView offers
 * "Take Photo" for that input, and an iOS app that opens the camera without
 * NSCameraUsageDescription is terminated on the spot — no prompt, no error.
 *
 * The key was added for that reason alone, and the privacy policy's iOS
 * permission line says so. If the picker goes, remove both together.
 */
describe('iOS camera usage string', () => {
  it('is present while an image picker ships on the phone tree', () => {
    expect(read('src/components/Feedback/ReportAttachments.tsx')).toMatch(/accept="image\/\*"/);
    expect(read('ios/App/App/Info.plist')).toMatch(/<key>NSCameraUsageDescription<\/key>/);
  });

  it('is disclosed in the app privacy policy', () => {
    expect(read('docs/privacy-policy-app.md')).toMatch(/\*\*iOS:\*\*[^\n]*camera/i);
  });
});
