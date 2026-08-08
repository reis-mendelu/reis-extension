import { registerPlugin } from '@capacitor/core';
import type { PlatformStorage } from './types';

interface SecureStoreNativePlugin {
  set(o: { key: string; value: string }): Promise<void>;
  get(o: { key: string }): Promise<{ value: string | null }>;
  remove(o: { key: string }): Promise<void>;
}

/**
 * Android-only native plugin. Values are encrypted with an AES-256-GCM key that
 * lives in the Android Keystore and never enters the JS heap or the filesystem;
 * only ciphertext is persisted.
 *
 * iOS is NOT implemented — the app has never been built for iOS (#174), and the
 * Keychain half lands there, where it can actually be compiled and run. Calling
 * this on iOS rejects from the bridge (no such plugin method), which is the
 * intended outcome: a missing implementation must surface as a failure, never
 * as a quiet fallback that writes a live credential to plaintext.
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
