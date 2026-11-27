/**
 * Whether Novinky offers "Nová verze reISu", from what the store said
 * (`@capawesome/capacitor-app-update`'s getAppUpdateInfo). Pure: the phone's
 * src/mobile/appUpdate asks the store and keeps the answer in the store slice.
 *
 * Why it exists: on 15 Nov 2026 IS changed its markup, 5.7.0 already read it,
 * and ~230 phones still on 5.6.0 lost Předměty with no way to hear about the
 * fix (suggestion 46). Stores auto-update most phones within days; this is for
 * the rest.
 */

/** Days a version is out before Novinky mentions it: most phones update on their own by then. */
export const UPDATE_GRACE_DAYS = 3;

/** The plugin's AppUpdateAvailability.UPDATE_AVAILABLE. */
export const UPDATE_AVAILABLE = 2;

/** The fields of the plugin's AppUpdateInfo this decision reads. */
export interface StoreUpdateInfo {
  updateAvailability: number;
  /** iOS only. */
  availableVersionName?: string;
  /** iOS only: ISO date the App Store version was released. */
  availableVersionReleaseDate?: string;
  /** iOS only. */
  minimumOsVersion?: string;
  /** Android only. */
  availableVersionCode?: string;
  /** Android only: days since the Play Store app learnt of the update. */
  clientVersionStalenessDays?: number;
}

export interface AppUpdateOffer {
  /** One row per version: seen once, it stays seen until the next version. */
  id: string;
  /** Shown in the row when the store names it (iOS); Play gives only a code. */
  version: string | null;
}

export const DAY_MS = 86_400_000;

/** Numeric dotted-version compare: 17.0 vs 16.7 → positive. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function appUpdateOffer(
  info: StoreUpdateInfo,
  platform: 'ios' | 'android',
  now: Date,
  /** iOS version of this device ("18.1"), or null when unknown. */
  osVersion: string | null = null
): AppUpdateOffer | null {
  if (info.updateAvailability !== UPDATE_AVAILABLE) return null;

  if (platform === 'android') {
    const days = info.clientVersionStalenessDays;
    if (typeof days !== 'number' || days < UPDATE_GRACE_DAYS) return null;
    if (!info.availableVersionCode) return null;
    return { id: `app-update:${info.availableVersionCode}`, version: null };
  }

  const version = info.availableVersionName;
  const released = Date.parse(info.availableVersionReleaseDate ?? '');
  if (!version || Number.isNaN(released)) return null;
  if (now.getTime() - released < UPDATE_GRACE_DAYS * DAY_MS) return null;
  // A version this iPhone cannot install would be a row with no way out.
  if (osVersion && info.minimumOsVersion && compareVersions(info.minimumOsVersion, osVersion) > 0)
    return null;
  return { id: `app-update:${version}`, version };
}
