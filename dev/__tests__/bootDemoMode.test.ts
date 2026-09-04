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
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: true }, { enterDemo });
    expect(enterDemo).not.toHaveBeenCalled();
  });

  it('enters demo mode when the flag is set', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    const { bootDemoMode } = await import('../bootDemoMode');
    await bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo });
    expect(enterDemo).toHaveBeenCalledOnce();
  });

  // A failed boot must leave the page usable rather than throwing into the
  // module graph — the banner and the shell should still render.
  it('does not throw when entering demo mode fails', async () => {
    const enterDemo = vi.fn().mockRejectedValue(new Error('nope'));
    const { bootDemoMode } = await import('../bootDemoMode');
    await expect(
      bootDemoMode({ DEV: false, VITE_PREVIEW_BUILD: 'true' }, { enterDemo })
    ).resolves.toBeUndefined();
  });
});
