import { describe, it, expect } from 'vitest';
import { isHarnessEnabled, isPreviewBuild } from '../harnessEnabled';

describe('isHarnessEnabled', () => {
  it('is on in a dev server build', () => {
    expect(isHarnessEnabled({ DEV: true })).toBe(true);
  });

  it('is on in a preview build even though DEV is false', () => {
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  it('is off in an extension or Capacitor build', () => {
    expect(isHarnessEnabled({ DEV: false })).toBe(false);
  });

  // Vite inlines every VITE_* variable as a STRING. A `false` that arrives as
  // the string "false" is truthy, so a bare truthiness check would turn the
  // harness on for anyone who set the flag to switch it off.
  it('treats any value other than the string "true" as off', () => {
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: 'false' })).toBe(false);
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: '' })).toBe(false);
    expect(isHarnessEnabled({ DEV: false, VITE_PREVIEW_BUILD: '1' })).toBe(false);
  });
});

describe('isPreviewBuild', () => {
  // Narrower than isHarnessEnabled: a local dev:web run (DEV: true) must NOT
  // count here — earlyDemoMode.ts uses this to decide whether to enter demo
  // mode, and entering demo mode locally would wipe a developer's real scraped
  // snapshot (enterDemo() calls wipeSeeded() on the way in).
  it('is on only for the deployed preview build', () => {
    expect(isPreviewBuild({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  it('is off on a local dev server even though isHarnessEnabled is on', () => {
    expect(isPreviewBuild({ DEV: true })).toBe(false);
    expect(isPreviewBuild({ DEV: true, VITE_PREVIEW_BUILD: 'false' })).toBe(false);
  });

  it('is off in an extension or Capacitor build', () => {
    expect(isPreviewBuild({ DEV: false })).toBe(false);
  });

  // Vite inlines every VITE_* variable as a STRING — see isHarnessEnabled's
  // test above for the same footgun.
  it('treats any value other than the string "true" as off', () => {
    expect(isPreviewBuild({ VITE_PREVIEW_BUILD: 'false' })).toBe(false);
    expect(isPreviewBuild({ VITE_PREVIEW_BUILD: '' })).toBe(false);
    expect(isPreviewBuild({ VITE_PREVIEW_BUILD: '1' })).toBe(false);
  });
});
