import { clearJar } from './iskamCookieStore';
import { IDP_COOKIE_URL, ISKAM_COOKIE_URL } from './iskamJar';
import { useIskamStore } from './iskamStore';

/**
 * The WebISKAM half of signing out: the secure-store jar, then the native
 * cookie stores.
 *
 * The native stores are NOT just seeded from the secure jar: on Android
 * Capacitor's own CookieHandler copies every CapacitorHttp response cookie into
 * the WebView jar — under the request URL and under the app's own origin — and
 * on iOS URLSession keeps them in HTTPCookieStorage. So Android empties the
 * whole WebView jar (the sign-out reloads into a fresh IS login, which clears
 * it anyway), and both clear the two WebISKAM URLs. The native clears run even
 * when the secure store refuses, so a failed step never leaves the native
 * copies for the next student on the device.
 */
export async function clearIskam(): Promise<void> {
  useIskamStore.getState().signOut();
  // The native clears run whatever the secure store says; the first failure is
  // reported afterwards (signOut logs it) rather than swallowed.
  const jarError = await settle(clearJar());
  const [{ InAppBrowser }, { Capacitor, CapacitorCookies }] = await Promise.all([
    import('@capgo/capacitor-inappbrowser'),
    import('@capacitor/core'),
  ]);
  const android = Capacitor.getPlatform() === 'android';
  const [all, ...perUrl] = await Promise.all([
    android ? settle(CapacitorCookies.clearAllCookies()) : Promise.resolve(null),
    ...[ISKAM_COOKIE_URL, IDP_COOKIE_URL].map((url) =>
      Promise.all([
        settle(InAppBrowser.clearCookies({ url })),
        settle(CapacitorCookies.clearCookies({ url })),
      ])
    ),
  ]);
  if (jarError) throw jarError;
  // Android's whole jar must go (it also holds app-origin copies); per URL, one
  // store succeeding is a normal sign-out (InAppBrowser rejects with no dialog).
  if (all) throw all;
  const stuck = perUrl.find((pair) => pair.every((err) => err !== null));
  if (stuck) throw stuck[0];
}

/** The error a promise rejected with, or null. */
function settle(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e ?? new Error('cookie clear failed')
  );
}
