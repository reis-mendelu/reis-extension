import type { DesktopEduroamTarget } from '../components/Eduroam/manual';

/**
 * Which eduroam manual fits the machine reIS is open on, or null when there
 * is no manual for it.
 *
 * Deliberately three answers rather than `isMac ? 'mac' : 'windows'`: reIS
 * ships steps for exactly two desktops, and a Linux or ChromeOS student
 * handed the geteduroam wizard gets instructions for somebody else's
 * computer. Null is "ask" — the drawer keeps the device picker it already
 * has, which is the honest fallback.
 *
 * Read at call time, not at module load, so a test can change the answer.
 */
export function desktopEduroamTarget(): DesktopEduroamTarget | null {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Mac/i.test(ua)) return 'mac';
  if (/Win/i.test(ua)) return 'windows';
  return null;
}
