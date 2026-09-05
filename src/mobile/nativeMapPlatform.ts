import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../platform';
import type { MapPlatform } from '../utils/venueMapUrl';

/**
 * Which map vocabulary this device speaks: `ios`, `android`, or `web`.
 *
 * The same question `openVenue` asks before handing a venue off, asked here so
 * the Profil row can agree with the tap. Asked of Capacitor rather than guessed
 * from the user agent, for the reason `nativeEduroamTarget` gives: a WKWebView
 * can report itself as a Macintosh.
 *
 * `web` covers both browsers — the extension and the dev harness — where a
 * venue opens one Google URL and there is no choice to store.
 */
export function nativeMapPlatform(): MapPlatform {
  const forced = devForcedPlatform();
  if (forced) return forced;
  if (getPlatform().kind !== 'capacitor') return 'web';
  // Both native values named, and anything else — including Capacitor's own
  // `web` — falling to `web`. The ternary this replaces read
  // `=== 'android' ? 'android' : 'ios'`, so a `web` result claimed to be an
  // iPhone and Profil offered a map-app choice that `openVenue` would never
  // consult. `nativeEduroamTarget` handles its own platform the same explicit
  // way, for the same reason.
  const os = Capacitor.getPlatform();
  return os === 'ios' || os === 'android' ? os : 'web';
}

/**
 * `?native=ios` / `?native=android` on the dev webapp, and nothing anywhere
 * else — `import.meta.env.DEV` dead-code-strips this out of every shipped
 * build, exactly as `devForcedTarget` does for the eduroam card.
 *
 * The Profil map row is Capacitor-gated, so a browser run cannot see it at all
 * and `verify:ui` would report a clean screen it never measured. This is what
 * makes the iPad geometries measurable. Only the *gate* is forced: picking an
 * option still runs the real `setPreferredMapApp`, which is honest — the
 * preference is stored in IndexedDB on any platform.
 */
function devForcedPlatform(): MapPlatform | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('native');
  return v === 'ios' || v === 'android' ? v : null;
}
