import { Geolocation } from '@capacitor/geolocation';
import { getPlatform } from '../../platform';
import { devForcedPosition } from './devPosition';

/**
 * A position fix, but only if taking one costs the student nothing.
 *
 * The route offer is hidden where no walk can be built, and knowing that needs
 * a position — which is a permission prompt. Tapping a lesson's map icon is a
 * lighter intent than "walk me there", so this asks the plugin what it has
 * already been granted and goes no further. The prompt still belongs to the
 * press, exactly where it was.
 *
 * Every failure is `null`, never a throw: nothing on screen depends on this
 * succeeding. A null leaves the offer showing, which is also what a device
 * that never granted location does — see `canRouteFrom`, where not knowing is
 * deliberately not a no.
 */
export async function quietPosition(): Promise<[number, number] | null> {
  const forced = devForcedPosition();
  if (forced) return forced;
  if (getPlatform().kind !== 'capacitor') return null;
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return null;
    // Shorter than the press's 10s and happy with a coarse fix: this decides
    // whether to draw a pill, not where to start a walk. A student who presses
    // still gets the accurate fix from `currentPosition`.
    const fix = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 4_000,
    });
    return [fix.coords.longitude, fix.coords.latitude];
  } catch {
    return null;
  }
}
