import { registerPlugin } from '@capacitor/core';
import type { PlatformStorage } from './types';

interface SecureStoreNativePlugin {
  set(o: { key: string; value: string }): Promise<void>;
  get(o: { key: string }): Promise<{ value: string | null }>;
  remove(o: { key: string }): Promise<void>;
}

/**
 * Native plugin, implemented on both mobile platforms — the credential never
 * touches `platform.storage`, which is plaintext on either OS.
 *
 * Android encrypts with an AES-256-GCM key generated inside the Android
 * Keystore; only ciphertext is persisted. iOS stores the value in the Keychain
 * (`kSecClassGenericPassword`, accessible after first unlock, this device only),
 * which encrypts at rest under a key outside the app process — so the iOS half
 * writes no cipher code of its own.
 *
 * This module is the Capacitor implementation only. The other two hosts supply
 * their own `secureStorage` and neither has a keystore to reach for: the
 * extension maps it onto `chrome.storage.local` (its threat model is the browser
 * profile, not a lost handset) and the dev webapp onto an in-memory Map. Do not
 * "unify" them onto this plugin — `registerPlugin` has nothing to talk to off
 * Capacitor.
 */
const SecureStore = registerPlugin<SecureStoreNativePlugin>('SecureStore');

/**
 * Strings only. The native side stores bytes, and JSON-encoding here would let
 * a caller believe arbitrary objects are supported — this exists for one short
 * credential, and a wider contract invites storing more than belongs in it.
 */
export const capacitorSecureStorage: PlatformStorage = {
  async get(key) {
    const { value } = await SecureStore.get({ key });
    return value ?? undefined;
  },
  async set(key, value) {
    if (typeof value !== 'string') {
      throw new Error('secureStorage holds strings only');
    }
    await SecureStore.set({ key, value });
  },
  async remove(key) {
    await SecureStore.remove({ key });
  },
};
