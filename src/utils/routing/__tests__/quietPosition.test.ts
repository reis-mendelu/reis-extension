import { describe, it, expect, beforeEach, vi } from 'vitest';

const checkPermissions = vi.fn();
const getCurrentPosition = vi.fn();
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: () => checkPermissions(),
    getCurrentPosition: (o: unknown) => getCurrentPosition(o),
  },
}));
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor' }) }));

import { quietPosition } from '../quietPosition';

/**
 * A fix taken only when it costs the student nothing.
 *
 * The offer is hidden where no walk can be built, which needs a position — and
 * a position is a permission prompt. Landing on the map from a lecture is a
 * lighter intent than "walk me there", so this asks the plugin what it has
 * already been granted and stops there. The prompt still belongs to the press.
 */
describe('quietPosition', () => {
  beforeEach(() => {
    checkPermissions.mockReset();
    getCurrentPosition.mockReset();
  });

  it('takes a fix when the student already granted location', async () => {
    checkPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockResolvedValue({ coords: { longitude: 16.61, latitude: 49.21 } });
    expect(await quietPosition()).toEqual([16.61, 49.21]);
  });

  it('asks for nothing when permission has not been granted', async () => {
    checkPermissions.mockResolvedValue({ location: 'prompt' });
    expect(await quietPosition()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('asks for nothing when it was refused', async () => {
    checkPermissions.mockResolvedValue({ location: 'denied' });
    expect(await quietPosition()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('is null rather than a throw when the fix fails', async () => {
    // Nothing on screen depends on this succeeding: a null simply leaves the
    // offer showing, which is what happens on a device that never granted
    // location at all.
    checkPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockRejectedValue(new Error('timeout'));
    expect(await quietPosition()).toBeNull();
  });
});
