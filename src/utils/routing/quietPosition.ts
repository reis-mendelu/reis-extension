import { devForcedPosition } from './devPosition';

/**
 * A position fix, but only if taking one costs the student nothing — PARKED.
 *
 * The route offer is hidden where no walk can be built, and knowing that needs
 * a position. This used to ask the Geolocation plugin what it had already been
 * granted (`checkPermissions`) and take a coarse 4-second fix only then, so the
 * prompt stayed with the press.
 *
 * Campus navigation is dormant (./navigationEnabled.ts) and the plugin is
 * uninstalled, so there is nothing to ask: every build answers `null`, which
 * `canRouteFrom` treats as "not known" rather than "no". The dev override still
 * answers, so the harness can exercise the offer. The real body is in #368's
 * history; src/test/guards/campusNavigationIsDormant.test.ts lists what
 * reviving the feature takes.
 */
export async function quietPosition(): Promise<[number, number] | null> {
  return devForcedPosition();
}
