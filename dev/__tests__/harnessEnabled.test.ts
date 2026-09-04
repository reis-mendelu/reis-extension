import { describe, it, expect } from 'vitest';
import { isHarnessEnabled } from '../harnessEnabled';

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
