import { clearJar } from './iskamCookieStore';
import { IDP_COOKIE_URL, ISKAM_COOKIE_URL } from './iskamJar';
import { useIskamStore } from './iskamStore';

/**
 * The WebISKAM half of signing out: the stored jar (authoritative — the native
 * jars are only ever seeded from it), then both native jars best-effort, for
 * the same reasons signOut's IS cookies are best-effort (InAppBrowser rejects
 * on Android with no dialog open).
 */
export async function clearIskam(): Promise<void> {
  useIskamStore.getState().reset();
  await clearJar();
  const [{ InAppBrowser }, { CapacitorCookies }] = await Promise.all([
    import('@capgo/capacitor-inappbrowser'),
    import('@capacitor/core'),
  ]);
  await Promise.allSettled(
    [ISKAM_COOKIE_URL, IDP_COOKIE_URL].flatMap((url) => [
      InAppBrowser.clearCookies({ url }),
      CapacitorCookies.clearCookies({ url }),
    ])
  );
}
