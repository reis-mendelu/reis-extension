import { describe, it, expect, vi } from 'vitest';
import { shouldBootDemoMode } from '../bootDemoMode';

describe('shouldBootDemoMode', () => {
  it('boots on the deployed preview', () => {
    expect(shouldBootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' })).toBe(true);
  });

  // A local dev:web run reads the real scraped snapshot. Entering demo mode
  // there would wipe it (enterDemo calls wipeSeeded) and replace a developer's
  // real data with fabricated data they did not ask for.
  it('never boots on a local dev server', () => {
    expect(shouldBootDemoMode({ DEV: true })).toBe(false);
  });

  it('never boots in an extension or Capacitor build', () => {
    expect(shouldBootDemoMode({ DEV: false })).toBe(false);
  });

  it('treats any value other than the string "true" as off', () => {
    expect(shouldBootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'false' })).toBe(false);
  });
});

describe('bootDemoMode', () => {
  it('does nothing when the flag is absent', async () => {
    const enterDemo = vi.fn();
    const refresh = vi.fn();
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: true }, { enterDemo, refresh });
    expect(enterDemo).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('enters demo mode when the flag is set', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo, refresh });
    expect(enterDemo).toHaveBeenCalledOnce();
  });

  // MockManager (called by enterDemo) writes the demo dataset to IndexedDB
  // only — it never touches the store. Without this second call, the app's
  // own boot has already read the (then-empty) schedule/exams/study-plan
  // stores into the store before enterDemo ran, and nothing re-reads them
  // afterward: a first-time visitor's screens stay on their empty state
  // forever, seeded data sitting unread in IndexedDB. Verified in a browser
  // against a never-before-visited origin.
  it('refreshes the store from IndexedDB after entering demo mode', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo, refresh });
    expect(refresh).toHaveBeenCalledOnce();
  });

  // A failed boot must leave the page usable rather than throwing into the
  // module graph — the banner and the shell should still render.
  it('does not throw when entering demo mode fails', async () => {
    const enterDemo = vi.fn().mockRejectedValue(new Error('nope'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await expect(
      bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo, refresh })
    ).resolves.toBeUndefined();
  });

  // There is nothing seeded to refresh if enterDemo itself never finished —
  // calling refresh anyway would read whatever was there before (nothing, on
  // a fresh visitor) and prove nothing.
  it('does not refresh when entering demo mode fails', async () => {
    const enterDemo = vi.fn().mockRejectedValue(new Error('nope'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo, refresh });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('shouldLoadRealData', () => {
  it('is on for a preview build asking for real data', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' })).toBe(true);
  });

  it('is off for the demo preview', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ VITE_PREVIEW_BUILD: 'true' })).toBe(false);
  });

  // Belt and braces: the flag alone must not be enough, so a stray
  // VITE_PREVIEW_DATA in someone's .env cannot make a local dev server try to
  // fetch a file that is not there.
  it('needs the preview build too, not just the data flag', async () => {
    const { shouldLoadRealData } = await import('../bootDemoMode');
    expect(shouldLoadRealData({ DEV: true, VITE_PREVIEW_DATA: 'real' })).toBe(false);
  });
});

describe('bootDemoMode in real-data mode', () => {
  it('loads the sanitised snapshot instead of the demo dataset', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const loadSnapshot = vi.fn().mockResolvedValue(true);
    const { bootDemoMode } = await import('../bootDemoMode');

    await bootDemoMode(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      { enterDemo, refresh, loadSnapshot }
    );

    expect(loadSnapshot).toHaveBeenCalledWith('/preview-data.json');
    expect(enterDemo).not.toHaveBeenCalled();
  });
});
