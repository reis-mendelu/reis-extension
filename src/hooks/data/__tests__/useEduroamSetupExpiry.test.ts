import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { fetchEduroamCertMaterial, regenerateEduroamCert } from '../../../api/eduroam';
import { deliverEduroamProfile } from '../../../mobile/eduroamProfile';
import { nativeEduroamDeps } from '../../../mobile/eduroamNative';
import { useEduroamSetup } from '../useEduroamSetup';

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
  fetchEduroamPassword: vi.fn().mockResolvedValue('pw123'),
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

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * IS keeps offering a certificate after it expires and never replaces it on
 * its own. Installing it gave a network that cannot authenticate, reported as
 * success — on the phone and in the extension's profile download alike.
 */
describe('useEduroamSetup with an expired certificate', () => {
  it.each(['ios', 'mac'] as const)('stops before installing anything on %s', async (t) => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(material(EXPIRED));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run(t);
    });

    expect(result.current.status).toBe('expired');
    expect(result.current.expiredAt).toEqual(EXPIRED);
    expect(nativeEduroamDeps.configure).not.toHaveBeenCalled();
    expect(deliverEduroamProfile).not.toHaveBeenCalled();
    // Noticing expiry never generates: that stays the student's tap.
    expect(regenerateEduroamCert).not.toHaveBeenCalled();
  });

  it('generates a new certificate only on renew, then sets up with it', async () => {
    vi.mocked(fetchEduroamCertMaterial)
      .mockResolvedValueOnce(material(EXPIRED))
      .mockResolvedValueOnce(material(new Date(Date.now() + 366 * 86_400_000)));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });
    await act(async () => {
      await result.current.renew('ios');
    });

    expect(regenerateEduroamCert).toHaveBeenCalledTimes(1);
    expect(nativeEduroamDeps.configure).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('done');
    expect(result.current.expiredAt).toBeNull();
  });

  it('surfaces a failed generation as an error, not as the expiry again', async () => {
    vi.mocked(regenerateEduroamCert).mockRejectedValueOnce(new Error('eduroam: generate -> 500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.renew('ios');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.expiredAt).toBeNull();
    expect(result.current.error).toMatch(/generate/);
  });

  // An unreadable expiry is unknown, not expired: setup goes on as before.
  it('sets up normally when the expiry could not be read', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(material(null));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.status).toBe('done');
    expect(nativeEduroamDeps.configure).toHaveBeenCalledTimes(1);
  });

  it('sets up as usual and offers an early renewal when expiry is near', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000);
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(material(soon));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.status).toBe('done');
    expect(nativeEduroamDeps.configure).toHaveBeenCalledTimes(1);
    expect(result.current.expiresSoonAt).toEqual(soon);
    expect(regenerateEduroamCert).not.toHaveBeenCalled();
  });

  it('offers nothing early when expiry is far off', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValue(
      material(new Date(Date.now() + 200 * 86_400_000))
    );
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(result.current.expiresSoonAt).toBeNull();
  });
});
