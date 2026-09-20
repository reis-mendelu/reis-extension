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

export function devForcedPosition(): [number, number] | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('at');
  if (!raw) return null;
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lon] = parts;
  if (!plausibleLat(lat) || !plausibleLon(lon)) return null;
  return [lon, lat];
}
