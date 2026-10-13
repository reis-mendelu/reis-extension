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
  useIskamStore.getState().reset();
  try {
    await clearJar();
  } finally {
    const [{ InAppBrowser }, { Capacitor, CapacitorCookies }] = await Promise.all([
      import('@capgo/capacitor-inappbrowser'),
      import('@capacitor/core'),
    ]);
    await Promise.allSettled([
      ...(Capacitor.getPlatform() === 'android' ? [CapacitorCookies.clearAllCookies()] : []),
      ...[ISKAM_COOKIE_URL, IDP_COOKIE_URL].flatMap((url) => [
        InAppBrowser.clearCookies({ url }),
        CapacitorCookies.clearCookies({ url }),
      ]),
    ]);
  }
}
