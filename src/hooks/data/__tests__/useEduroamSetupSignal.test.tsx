import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { EduroamConfigOutcome } from '../../../mobile/configureEduroam';

const { trackFeatureSignal, configureEduroam, canConfigureNatively, deliverProfile } = vi.hoisted(
  () => ({
    trackFeatureSignal: vi.fn<(...a: unknown[]) => Promise<void>>(async () => {}),
    configureEduroam: vi.fn<(...a: unknown[]) => Promise<string>>(async () => 'saved'),
    canConfigureNatively: vi.fn<(...a: unknown[]) => boolean>(() => true),
    deliverProfile: vi.fn<(...a: unknown[]) => Promise<void>>(async () => {}),
  })
);

vi.mock('../../../api/featureUsage', () => ({
  trackFeatureSignal: (...a: unknown[]) => trackFeatureSignal(...a),
}));
vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: async () => ({
    rootCaDer: new Uint8Array([1]),
    clientP12: new Uint8Array([2]),
    password: 'pw',
    generated: false,
  }),
  fetchEduroamPassword: async () => null,
}));
vi.mock('../../../mobile/configureEduroam', () => ({
  configureEduroam: (...a: unknown[]) => configureEduroam(...a),
  isEduroamConfigured: (o: string | null) => o === 'saved' || o === 'already-configured',
}));
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: (...a: unknown[]) => canConfigureNatively(...a),
  nativeEduroamDeps: {},
}));
vi.mock('../../../mobile/eduroamProfile', () => ({
  deliverEduroamProfile: (...a: unknown[]) => deliverProfile(...a),
  buildProfileDelivery: () => ({ kind: 'anchor' }),
}));
vi.mock('../../../services/eduroam/mobileconfig', () => ({
  generateEduroamMobileconfig: () => '<plist/>',
}));
vi.mock('../../../services/eduroam/eapConfig', () => ({
  generateEapConfig: () => '<eap/>',
}));

import { useEduroamSetup } from '../useEduroamSetup';

/**
 * Which eduroam terminal state counts as "the student got onto eduroam".
 *
 * Four outcomes come back from the native path and only one of them is a
 * network that now exists because reIS was asked. The file paths are a
 * different claim again — a profile handed over, still to be installed — so
 * they get their own label rather than inflating the first number.
 */
describe('useEduroamSetup engagement signal', () => {
  beforeEach(() => {
    canConfigureNatively.mockReturnValue(true);
    configureEduroam.mockResolvedValue('saved');
  });
  afterEach(() => vi.clearAllMocks());

  it('counts a network the app actually saved', async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('eduroam_wifi_configured');
  });

  // The remaining native outcomes installed nothing. `already-configured` is
  // the subtle one: the network was there before reIS was asked, so counting it
  // would report students as newly set up who were already on eduroam.
  it.each<EduroamConfigOutcome>(['already-configured', 'cancelled', 'failed', 'stale-association'])(
    'counts nothing when the outcome is %s',
    async (outcome) => {
      configureEduroam.mockResolvedValue(outcome);
      const { result } = renderHook(() => useEduroamSetup());

      await act(async () => {
        await result.current.run('android');
      });

      expect(trackFeatureSignal).not.toHaveBeenCalled();
    }
  );

  it.each(['mac', 'windows'] as const)(
    'counts a delivered profile separately on %s',
    async (target) => {
      canConfigureNatively.mockReturnValue(false);
      const { result } = renderHook(() => useEduroamSetup());

      await act(async () => {
        await result.current.run(target);
      });

      expect(deliverProfile).toHaveBeenCalledTimes(1);
      expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('eduroam_profile_delivered');
    }
  );

  it('counts nothing when the profile could not be delivered', async () => {
    canConfigureNatively.mockReturnValue(false);
    deliverProfile.mockRejectedValueOnce(new Error('no disk'));
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('windows');
    });

    expect(trackFeatureSignal).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });

  // A browser on a phone has no native path and is refused before anything is
  // prepared — there is no setup to count.
  it('counts nothing when a phone browser is refused the file path', async () => {
    canConfigureNatively.mockReturnValue(false);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('ios');
    });

    expect(trackFeatureSignal).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });
});
