/**
 * `?at=<lat>,<lon>` on the dev webapp, and nothing anywhere else.
 *
 * `import.meta.env.DEV` dead-code-strips this out of every shipped build,
 * exactly as `devForcedPlatform` does for the Profil map row.
 *
 * Without it, verifying a route means carrying a laptop to the JAK
 * dormitories. With it, every position in the design — JAK, FRRMS, mid-campus,
 * two kilometres away — is one URL, and the check can be repeated by anyone.
 *
 * `lat,lon` ORDER, deliberately against this codebase's `[lon, lat]`
 * convention: the value is pasted straight out of Google Maps by a human, so it
 * takes the order a human copies, and transposes once here at the boundary. The
 * same reasoning as `'cz'` against the `'cs'` locale — convert where the
 * outside world meets the app, not everywhere inside it.
 */

// Brno sits near 49.2 N, 16.6 E. A pair that cannot be a Brno lat/lon in that
// order is almost certainly transposed. Refusing it costs a retry; accepting it
// puts the start of the route in the Indian Ocean, where the failure looks like
// "the router is broken" rather than "the URL is backwards".
const plausibleLat = (v: number) => v > 48 && v < 51;
const plausibleLon = (v: number) => v > 12 && v < 19;

/** `lat,lon` → the app's `[lon, lat]`, or null if it is not a Brno pair. */
function parseLatLon(raw: string | undefined | null): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((p) => Number(p.trim()));
  const [lat, lon] = parts;
  if (parts.length !== 2 || lat === undefined || lon === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!plausibleLat(lat) || !plausibleLon(lon)) return null;
  return [lon, lat];
}

export function devForcedPosition(): [number, number] | null {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    const fromUrl = parseLatLon(new URLSearchParams(window.location.search).get('at'));
    if (fromUrl) return fromUrl;
  }
  // And a position baked in at BUILD time, which is the only way to fake one
  // in the app on a phone. `?at=` cannot reach it — a Capacitor WebView loads
  // the bundle with no query string, and the DEV guard strips that branch from
  // a release build anyway — so testing a walk otherwise means physically
  // standing somewhere else. Standing at PEF, which is where the walks end,
  // there is no walk to look at.
  //
  // Guarded by the variable's own absence rather than by DEV: nothing sets it
  // in CI or in a store build, where this reads `undefined` and returns null.
  // Set it deliberately for a test APK:
  //
  //   VITE_DEV_POSITION=49.218161,16.614118 npm run android:apk
  return bakedPosition(import.meta.env.VITE_DEV_POSITION as string | undefined);
}

/** Exported for its test: the build-time position, parsed and sanity-checked. */
export function bakedPosition(raw: string | undefined): [number, number] | null {
  return parseLatLon(raw);
}

/**
 * `?now=<ISO datetime>` on the dev webapp, and nothing anywhere else.
 *
 * The garden's hours are the one piece of this feature that cannot be checked
 * by standing somewhere: to see the weekday route you have to ask on a weekday,
 * and to see the closed-gate copy you have to ask at the weekend. Waiting for
 * Tuesday is not a verification strategy, and moving the laptop's clock breaks
 * everything else in the app that reads a date.
 *
 * Same DEV guard and the same reasoning as `devForcedPosition`: stripped from
 * every shipped build, so no student can talk the router into believing the
 * garden is open at midnight.
 */
export function devForcedNow(): Date | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('now');
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}
