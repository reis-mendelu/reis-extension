import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { fetchEduroamCertMaterial, regenerateEduroamCert } from '../../../api/eduroam';
import { useEduroamSetup } from '../useEduroamSetup';

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn(),
  fetchEduroamPassword: vi.fn().mockResolvedValue(null),
  regenerateEduroamCert: vi.fn(),
}));

vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(true),
  nativeEduroamDeps: { configure: vi.fn() },
}));

/** What CapacitorHttp rejects with on an iPhone that has no connection. */
const iosOffline = Object.assign(new Error('Připojení k internetu je pravděpodobně offline.'), {
  code: 'NSURLErrorDomain',
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Being off Wi‑Fi is not the problem — setup only needs internet to fetch the
 * certificate from IS, and mobile data is enough. Being offline is, and the
 * student has to be told that in words rather than a raw OS string.
 */
describe('useEduroamSetup, without a network', () => {
  it('does not ask IS at all when the device says it is offline', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(fetchEduroamCertMaterial).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.networkFailure).toBe('offline');
  });

  it('names a request that never got an answer as unreachable', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockRejectedValueOnce(iosOffline);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.networkFailure).toBe('unreachable');
  });

  it('leaves an IS failure unclassified, so its own text still shows', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockRejectedValueOnce(new Error('HTTP 500'));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.networkFailure).toBeNull();
    expect(result.current.error).toBe('HTTP 500');
  });

  it('classifies a failed certificate renewal the same way', async () => {
    vi.mocked(regenerateEduroamCert).mockRejectedValueOnce(iosOffline);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.renew('ios');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.networkFailure).toBe('unreachable');
  });

  it('clears the failure when the student tries again', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockRejectedValueOnce(iosOffline);
    const { result } = renderHook(() => useEduroamSetup());
    await act(async () => {
      await result.current.run('ios');
    });

    act(() => result.current.reset());

    expect(result.current.networkFailure).toBeNull();
  });
});
