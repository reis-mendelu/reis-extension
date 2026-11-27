import { compareVersions, DAY_MS, UPDATE_AVAILABLE, type StoreUpdateInfo } from './appUpdateOffer';

/**
 * When the phone explains that this build is broken and an update fixes it.
 * Pure: src/mobile/criticalUpdate asks Supabase and the store, and keeps the
 * answer in the app-update slice.
 *
 * Why it exists: on 15 Nov 2026 IS changed its markup. 5.7.0 already read it,
 * but 5.6.0 showed an empty Předměty, and two students on it reported "no
 * subjects" (suggestions 46, 47) instead of updating: the "Nová verze reISu"
 * row in Novinky is easy to miss. Agreed with Dominik on 2026-11-20:
 *
 * - A version is critical only when reIS says so, by hand: one row in the
 *   `critical_app_version` table. It happens about once in five years, so
 *   there is no admin form. Ordinary releases never trigger any of this.
 * - Never forced. The pop-up can always be closed, and is shown at most
 *   twice: the first time the app opens after the flag, and once more on a
 *   later day. Phones update on their own soon after anyway.
 * - Only when the store can actually hand over the fix, so the button never
 *   leads to a store page with nothing to install.
 */

/** The `critical_app_version` row: installs below `minVersion` are broken. */
export interface CriticalVersion {
  minVersion: string;
  /** One or two sentences: what changed and what does not work. */
  reason: { cz: string; en: string };
}

/** How many times the pop-up may ever appear for one critical version. */
export const CRITICAL_POPUP_MAX = 2;

/** What the device remembers about the pop-up (IndexedDB `meta`). */
export interface PopupLog {
  minVersion: string;
  shown: number;
  /** dayKey() of the last time it appeared. */
  lastDay: string;
}

/** "5.10.2" from Play's version code 51002 (android/app/build.gradle). */
export function versionFromAndroidCode(code: string | number): string | null {
  const n = Number(code);
  if (!Number.isInteger(n) || n <= 0) return null;
  return `${Math.floor(n / 10000)}.${Math.floor(n / 100) % 100}.${n % 100}`;
}

/** The local calendar day, "2026-11-21". */
export function dayKey(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Whether this install is below the critical version AND the store offers a
 * version at or above it. `installed` is getAppVersion(); its '0.0.0' means
 * "unknown", never "old".
 */
export function criticalUpdateApplies(
  installed: string,
  critical: CriticalVersion | null,
  info: StoreUpdateInfo,
  platform: 'ios' | 'android',
  now: Date,
  /** iOS version of this device ("18.1"), or null when unknown. */
  osVersion: string | null = null
): boolean {
  if (!critical || installed === '0.0.0') return false;
  if (compareVersions(installed, critical.minVersion) >= 0) return false;
  if (info.updateAvailability !== UPDATE_AVAILABLE) return false;

  const offered =
    platform === 'android'
      ? info.availableVersionCode
        ? versionFromAndroidCode(info.availableVersionCode)
        : null
      : (info.availableVersionName ?? null);
  if (!offered || compareVersions(offered, critical.minVersion) < 0) return false;

  if (platform === 'ios') {
    // Apple's lookup can name a version hours before the App Store serves it.
    const released = Date.parse(info.availableVersionReleaseDate ?? '');
    if (Number.isNaN(released) || now.getTime() - released < DAY_MS) return false;
    // A version this iPhone cannot install would be a button with no way out.
    if (osVersion && info.minimumOsVersion && compareVersions(info.minimumOsVersion, osVersion) > 0)
      return false;
  }
  return true;
}

export function shouldShowCriticalPopup(
  log: PopupLog | null,
  minVersion: string,
  today: string
): boolean {
  if (!log || log.minVersion !== minVersion) return true;
  return log.shown < CRITICAL_POPUP_MAX && log.lastDay !== today;
}

export function nextPopupLog(log: PopupLog | null, minVersion: string, today: string): PopupLog {
  const shown = log && log.minVersion === minVersion ? log.shown : 0;
  return { minVersion, shown: shown + 1, lastDay: today };
}
