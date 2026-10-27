import { useState, useCallback } from 'react';
import type { EduroamCertMaterial } from '../../api/eduroam';
import type { ProfileRoute } from '../../mobile/eduroamProfile';
import { isShareCancellation } from '../../errors/shareCanceled';
import { deliverEduroamFile, openProfilesSettings } from './eduroamFileDelivery';

/**
 * The file half of `useEduroamSetup`'s run (a Mac or Windows profile), and the
 * one place the Mac's outcomes are told apart. Its own file so the setup hook
 * stays under the 200-line convention.
 *
 * `deliver` answers with the status the run ends in:
 * - `done` — the profile reached the student. `profileRoute` says how, because
 *   the next step differs: macOS opened Device Management on it (`opened`), or
 *   the student saved it with the Save panel and must open it (`saved`).
 * - `idle` — a Mac's Save panel was closed unsaved. Nothing was delivered, and
 *   nothing broke: back to the button, no error banner.
 *
 * Any other failure is thrown, for the run's own error handling.
 */
export function useEduroamProfileDelivery() {
  const [profileRoute, setProfileRoute] = useState<ProfileRoute | null>(null);

  const deliver = useCallback(
    async (
      t: 'mac' | 'windows',
      material: Pick<EduroamCertMaterial, 'rootCaDer' | 'clientP12'>
    ): Promise<'done' | 'idle'> => {
      setProfileRoute(null);
      try {
        setProfileRoute(await deliverEduroamFile(t, material));
        return 'done';
      } catch (e) {
        if (isShareCancellation(e)) return 'idle';
        throw e;
      }
    },
    []
  );

  /** What the setup hook passes through to its callers. */
  return { deliver, surface: { profileRoute, openProfilesSettings } };
}
