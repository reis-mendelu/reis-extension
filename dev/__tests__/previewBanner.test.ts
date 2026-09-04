import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowPreviewBanner, mountPreviewBanner } from '../previewBanner';

describe('shouldShowPreviewBanner', () => {
  it('shows on the deployed preview', () => {
    expect(shouldShowPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  // Deliberately NOT keyed off isHarnessEnabled: a local dev:web run already
  // knows it is local, and a permanent banner over every screen would get in
  // the way of the UI verification screenshots (scripts/shot.ts).
  it('stays out of the way on a local dev server', () => {
    expect(shouldShowPreviewBanner({ DEV: true })).toBe(false);
  });

  it('never shows in an extension or Capacitor build', () => {
    expect(shouldShowPreviewBanner({ DEV: false })).toBe(false);
  });
});

describe('mountPreviewBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('appends nothing when the banner is not wanted', () => {
    mountPreviewBanner({ DEV: true }, document);
    expect(document.querySelector('[data-testid="preview-banner"]')).toBeNull();
  });

  it('names both facts a reader has to know', () => {
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    const banner = document.querySelector('[data-testid="preview-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Sample data');
    expect(banner?.textContent).toContain('not saved');
  });

  it('mounts only once even if called twice', () => {
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    mountPreviewBanner({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, document);
    expect(document.querySelectorAll('[data-testid="preview-banner"]')).toHaveLength(1);
  });
});
