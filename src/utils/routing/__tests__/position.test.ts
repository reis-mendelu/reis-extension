import { describe, it, expect, beforeEach, vi } from 'vitest';

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const getCurrentPosition = vi.fn();
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    getCurrentPosition: (o: unknown) => getCurrentPosition(o),
  },
}));
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor' }) }));

import { currentPosition, isPermissionDenied } from '../position';

/**
 * Where the student is asked for their location, and when.
 *
 * Exactly once and exactly here: on the press of "Najdi cestu". Nothing else
 * in this feature asks — the offer's own proximity check reads
 * `checkPermissions` and stops (see quietPosition), so opening the map from a
 * lecture costs nothing.
 *
 * Asked EXPLICITLY rather than left to the plugin's own auto-request, which is
 * a side effect of `getCurrentPosition` and not the same on both platforms.
 * The press is what asks, and that is visible in this file.
 */
describe('currentPosition', () => {
  beforeEach(() => {
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    getCurrentPosition.mockReset();
    getCurrentPosition.mockResolvedValue({ coords: { longitude: 16.61, latitude: 49.21 } });
  });

  it('asks for permission on the first press', async () => {
    checkPermissions.mockResolvedValue({ location: 'prompt' });
    requestPermissions.mockResolvedValue({ location: 'granted' });
    expect(await currentPosition()).toEqual([16.61, 49.21]);
    expect(requestPermissions).toHaveBeenCalledOnce();
  });

  it('does not ask again once it has been granted', async () => {
    checkPermissions.mockResolvedValue({ location: 'granted' });
    expect(await currentPosition()).toEqual([16.61, 49.21]);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('takes a refusal at the prompt as a refusal', async () => {
    // Not a timeout and not a missing provider: the student said no, and
    // `isPermissionDenied` is how the caller tells those apart.
    checkPermissions.mockResolvedValue({ location: 'prompt' });
    requestPermissions.mockResolvedValue({ location: 'denied' });
    await expect(currentPosition()).rejects.toSatisfy(isPermissionDenied);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('accepts a coarse grant, which is plenty for a 400 m campus', async () => {
    checkPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
    expect(await currentPosition()).toEqual([16.61, 49.21]);
    expect(requestPermissions).not.toHaveBeenCalled();
  });
});
