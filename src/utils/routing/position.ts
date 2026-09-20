import { Geolocation } from '@capacitor/geolocation';
import { getPlatform } from '../../platform';
import { devForcedPosition } from './devPosition';

/** Thrown when this build has no way to ask for a position at all. */
export const NO_PLATFORM = 'geolocation: not a native platform';

/**
 * One position fix, as `[lon, lat]`.
 *
 * `getCurrentPosition`, never `watchPosition`. The plugin's own documentation
 * warns that watching "can consume a large amount of energy", and a route
 * already drawn on screen does not need re-deriving while the student walks
 * along it looking at it.
 *
 * Capacitor only. On the web the app is a `chrome-extension://` iframe inside
 * is.mendelu.cz, where geolocation needs `allow="geolocation"` set on the
 * iframe element by the content script — and a student sitting at a desk has no
 * use for a blue dot anyway. Gating on the platform sidesteps that question
 * rather than answering it.
 *
 * The dev override comes first so the browser harness can exercise every
 * position in the design without a GPS or a walk.
 */
export async function currentPosition(): Promise<[number, number]> {
  const forced = devForcedPosition();
  if (forced) return forced;
  if (getPlatform().kind !== 'capacitor') throw new Error(NO_PLATFORM);
  const fix = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10_000,
  });
  return [fix.coords.longitude, fix.coords.latitude];
}
