import { devForcedPosition } from './devPosition';

/** Thrown when this build has no way to ask for a position at all. */
export const NO_PLATFORM = 'geolocation: not a native platform';

/**
 * The only Capacitor Geolocation error that means the student said no.
 *
 * Everything else the plugin can reject with — the 10-second timeout, no
 * provider, a hardware failure — is a location that could not be had, not a
 * permission that was refused. Telling someone to go and change a setting they
 * never touched is worse than saying nothing.
 */
export const PERMISSION_DENIED_CODE = 'OS-PLUG-GLOC-0003';

export function isPermissionDenied(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code === PERMISSION_DENIED_CODE) return true;
  // The web shim and older plugin builds reject with a DOMException-shaped
  // object whose numeric code 1 is PERMISSION_DENIED.
  if (typeof code === 'number' && code === 1) return true;
  return /denied|permission/i.test(String((err as Error | null)?.message ?? ''));
}

/**
 * One position fix, as `[lon, lat]` — PARKED.
 *
 * Campus navigation is dormant (./navigationEnabled.ts), and the device half of
 * it is gone rather than hidden: `@capacitor/geolocation` is uninstalled and
 * neither native app declares a location permission, so no store has one to
 * review. Every build therefore answers "no platform", which the route slice
 * already reports as unavailable rather than as a refusal.
 *
 * The real body was `getCurrentPosition({ enableHighAccuracy: true, timeout:
 * 10_000 })` from the plugin, Capacitor only — never `watchPosition`, whose own
 * documentation warns it "can consume a large amount of energy". It is in git
 * at 2ccf9f40 (#366); src/test/guards/campusNavigationIsDormant.test.ts lists
 * everything else that has to come back with it.
 *
 * The dev override still comes first, so the browser harness can exercise the
 * router and the route UI without a GPS.
 */
export async function currentPosition(): Promise<[number, number]> {
  const forced = devForcedPosition();
  if (forced) return forced;
  throw new Error(NO_PLATFORM);
}
