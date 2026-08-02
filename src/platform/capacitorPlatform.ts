import { Preferences } from '@capacitor/preferences';
import type { ReisPlatform } from './types';

/**
 * Capacitor host. Preferences is UserDefaults / SharedPreferences — fine for
 * settings, and explicitly NOT where the session token goes; that needs real
 * Keychain/Keystore (see src/platform/tokenStore.ts).
 *
 * Preferences stores strings only, so values are JSON-encoded. `undefined` is
 * returned for a missing key to match the other platforms.
 */
export function createCapacitorPlatform(): ReisPlatform {
  return {
    kind: 'capacitor',
    storage: {
      async get(key) {
        const { value } = await Preferences.get({ key });
        if (value == null) return undefined;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      async set(key, value) {
        await Preferences.set({ key, value: JSON.stringify(value) });
      },
      async remove(key) {
        await Preferences.remove({ key });
      },
    },
    // Capacitor serves bundled assets from the WebView root.
    getAssetUrl: (path) => '/' + path.replace(/^\//, ''),
  };
}
