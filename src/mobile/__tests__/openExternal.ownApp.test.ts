import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'capacitor' })) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../handToSystem', () => ({ handToSystem: vi.fn() }));
const setExternalOpening = vi.hoisted(() => vi.fn());
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ setExternalOpening }) },
}));
const open = vi.hoisted(() => vi.fn());
vi.mock('@capgo/capacitor-inappbrowser', () => ({
  InAppBrowser: { open, openWebView: vi.fn(), addListener: vi.fn() },
}));

import { getPlatform } from '../../platform';
import { handToSystem } from '../handToSystem';
import { openExternal } from '../openExternal';

// A society's Instagram opened in Custom Tabs / SFSafariViewController is the
// web page, signed out, inside reIS ("doesn't open it in the Instagram app").
// Handed to the OS instead, Android's App Links and iOS's universal links open
// the Instagram app, or the browser when it is not installed.
describe('openExternal — links that have their own app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
    } as unknown as ReturnType<typeof getPlatform>);
  });

  it.each([
    'https://www.instagram.com/esnmendelubrno/',
    'https://instagram.com/p/abc/',
    'https://m.instagram.com/supefmendelu/',
  ])('hands %s to the OS, not the in-app browser', async (url) => {
    await openExternal(url);
    expect(handToSystem).toHaveBeenCalledWith(url);
    expect(open).not.toHaveBeenCalled();
    // No browser is coming, so the "opening" scrim must not go up.
    expect(setExternalOpening).not.toHaveBeenCalledWith(true);
  });

  it.each(['https://notinstagram.com/x', 'https://instagram.com.evil.io/x', 'https://esn.cz/'])(
    'keeps %s in the in-app browser',
    async (url) => {
      await openExternal(url);
      expect(handToSystem).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledWith({ url });
    }
  );

  it('off Capacitor an Instagram link is an ordinary new tab', async () => {
    vi.mocked(getPlatform).mockReturnValue({ kind: 'extension' } as unknown as ReturnType<
      typeof getPlatform
    >);
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternal('https://www.instagram.com/esnmendelubrno/');
    expect(handToSystem).not.toHaveBeenCalled();
    expect(winOpen).toHaveBeenCalled();
    winOpen.mockRestore();
  });
});
