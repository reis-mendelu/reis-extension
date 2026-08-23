import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const fetchViaProxy = vi.fn();
vi.mock('../proxyClient', () => ({
  fetchViaProxy: (...args: unknown[]) => fetchViaProxy(...args),
}));

// Defaults to 'extension' so the existing proxy-branch tests below are
// untouched; the demo-mode test overrides this to reach the Capacitor branch,
// which is the one that calls loadStoredToken and is reachable today from
// PersonSheet.
vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'extension' })) }));

import { fetchPersonPhoto, __resetPersonPhotoCache } from '../personPhoto';
import { getPlatform } from '../../platform';
import { DemoModeError } from '../../errors/demoMode';
import { useAppStore } from '../../store/useAppStore';

describe('fetchPersonPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPersonPhotoCache();
  });

  it('requests the authed foto.pl URL through the proxy with image responseType', async () => {
    fetchViaProxy.mockResolvedValue('data:image/jpeg;base64,AAAA');
    const url = await fetchPersonPhoto(12345);
    expect(url).toBe('data:image/jpeg;base64,AAAA');
    expect(fetchViaProxy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/lide/foto.pl?id=12345;lang=cz',
      { responseType: 'image' }
    );
  });

  it('caches per person — fetches once across repeated calls (number or string id)', async () => {
    fetchViaProxy.mockResolvedValue('data:image/jpeg;base64,BBBB');
    await fetchPersonPhoto(7);
    await fetchPersonPhoto('7');
    expect(fetchViaProxy).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures so a later mount can retry', async () => {
    fetchViaProxy.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchPersonPhoto(9)).rejects.toThrow('boom');
    fetchViaProxy.mockResolvedValueOnce('data:image/jpeg;base64,CCCC');
    const url = await fetchPersonPhoto(9);
    expect(url).toBe('data:image/jpeg;base64,CCCC');
    expect(fetchViaProxy).toHaveBeenCalledTimes(2);
  });
});

describe('fetchPersonPhoto in demo mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPersonPhotoCache();
    useAppStore.setState({ demoMode: true });
  });
  afterEach(() => useAppStore.setState({ demoMode: false }));

  // PersonSheet calls usePersonPhoto on mount — tapping a teacher in the demo
  // schedule reaches this on the Capacitor branch of fetchDataUrl, which
  // sends the stored session token to is.mendelu.cz/auth/lide/foto.pl. That
  // branch has no guard of its own; it relies on loadStoredToken throwing
  // before the token can be read.
  it('throws DemoModeError on the Capacitor path instead of sending the token to IS', async () => {
    vi.mocked(getPlatform).mockReturnValueOnce({
      kind: 'capacitor',
    } as ReturnType<typeof getPlatform>);

    await expect(fetchPersonPhoto(42)).rejects.toBeInstanceOf(DemoModeError);
    expect(fetchViaProxy).not.toHaveBeenCalled();
  });
});
