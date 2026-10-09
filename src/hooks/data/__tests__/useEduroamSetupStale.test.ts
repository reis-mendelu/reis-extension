import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { fetchEduroamCertMaterial, regenerateEduroamCert } from '../../../api/eduroam';
import { useEduroamSetup } from '../useEduroamSetup';
import { nativeEduroamDeps } from '../../../mobile/eduroamNative';

const EXPIRED = new Date('2025-01-01T12:00:00Z');
const material = (expiresAt: Date | null) => ({
  rootCaDer: new Uint8Array([1]),
  clientP12: new Uint8Array([2]),
  password: 'pw123',
  generated: false,
  expiresAt,
});

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn(),
  fetchEduroamPassword: vi.fn().mockResolvedValue(null),
  regenerateEduroamCert: vi.fn(async () => {}),
}));
vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));
vi.mock('../../../services/eduroam/mobileconfig', () => ({
  generateEduroamMobileconfig: vi.fn().mockReturnValue('<xml/>'),
}));
vi.mock('../../../services/eduroam/eapConfig', () => ({
  generateEapConfig: vi.fn().mockReturnValue('<eap-config/>'),
}));
vi.mock('../../../mobile/eduroamProfile', () => ({
  deliverEduroamProfile: vi.fn(async () => {}),
  buildProfileDelivery: vi.fn(() => ({ kind: 'web' })),
}));
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn((t: string) => t === 'ios'),
  nativeEduroamDeps: { configure: vi.fn().mockResolvedValue({ outcome: 'saved' }) },
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Closing the drawer (or "pick another device") resets the flow while a
 * request may still be out. Its late result used to land anyway: an expired
 * certificate brought back the renewal notice with no device selected, so its
 * button did nothing at all. A result that outlived its run is dropped.
 */
describe('useEduroamSetup drops a result that outlived its run', () => {
  it('ignores certificate material that arrives after a reset', async () => {
    const cert = deferred<ReturnType<typeof material>>();
    vi.mocked(fetchEduroamCertMaterial).mockReturnValue(cert.promise);
    const { result } = renderHook(() => useEduroamSetup());

    let running!: Promise<void>;
    act(() => {
      running = result.current.run('mac');
    });
    act(() => result.current.reset());
    await act(async () => {
      cert.resolve(material(EXPIRED));
      await running;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.expiredAt).toBeNull();
  });

  /** Android/iOS answering after a reset must not leave its outcome behind. */
  it('ignores a native outcome that arrives after a reset', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(material(null));
    const saved = deferred<{ outcome: string }>();
    vi.mocked(nativeEduroamDeps.configure).mockReturnValue(saved.promise as never);
    const { result } = renderHook(() => useEduroamSetup());

    let running!: Promise<void>;
    act(() => {
      running = result.current.run('ios');
    });
    await vi.waitFor(() => expect(nativeEduroamDeps.configure).toHaveBeenCalled());
    act(() => result.current.reset());
    await act(async () => {
      saved.resolve({ outcome: 'saved' });
      await running;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.outcome).toBeNull();
  });

  it('ignores a failure that arrives after another device was picked', async () => {
    const cert = deferred<ReturnType<typeof material>>();
    vi.mocked(fetchEduroamCertMaterial).mockReturnValue(cert.promise);
    const { result } = renderHook(() => useEduroamSetup());

    let running!: Promise<void>;
    act(() => {
      running = result.current.run('mac');
    });
    act(() => result.current.selectTarget('windows'));
    await act(async () => {
      cert.reject(new Error('IS 500'));
      await running;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('does not go on to set up after a renewal that outlived its run', async () => {
    const regen = deferred<void>();
    vi.mocked(regenerateEduroamCert).mockReturnValue(regen.promise);
    const { result } = renderHook(() => useEduroamSetup());

    let renewing!: Promise<void>;
    act(() => {
      renewing = result.current.renew('mac');
    });
    act(() => result.current.reset());
    await act(async () => {
      regen.resolve();
      await renewing;
    });

    expect(fetchEduroamCertMaterial).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('still applies the result of a run nothing interrupted', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(material(EXPIRED));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('mac');
    });

    expect(result.current.status).toBe('expired');
    expect(result.current.expiredAt).toEqual(EXPIRED);
  });
});
