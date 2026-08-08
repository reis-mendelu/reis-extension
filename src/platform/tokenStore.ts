import { getPlatform } from './index';
import { isPlausibleToken } from './sessionToken';

const TOKEN_KEY = 'reis.session.uisAuth';

/**
 * The ONLY module that touches the IS session token.
 *
 * UISAuth authenticates as the student on its own, never rotates, and IS allows
 * concurrent sessions — so anything that can read it can act as that student.
 * It goes to `platform.secureStorage` (Keystore-encrypted on Capacitor), never
 * to `platform.storage`, which is SharedPreferences/UserDefaults in the clear.
 *
 * Call sites used to reach `storage.get/set(TOKEN_KEY)` directly — the login
 * flow wrote the token that way while this module was left unused. Keeping the
 * key private to this file is what stops that from coming back.
 */
export async function saveStoredToken(token: string): Promise<void> {
  await getPlatform().secureStorage.set(TOKEN_KEY, token);
}

/**
 * Throws with `sessionExpired` rather than returning null so callers treat a
 * missing token exactly like a lapsed one — both mean "send the student to
 * login", and a nullable return invites a silent unauthenticated request.
 *
 * A secure-store READ FAILURE lands here too. The Keystore key is invalidated
 * by a credential change or a restore onto new hardware, and decryption then
 * throws; that is a lapsed session, not a crash — and emphatically not a reason
 * to look in plaintext storage instead.
 */
export async function loadStoredToken(): Promise<string> {
  let value: unknown;
  try {
    value = await getPlatform().secureStorage.get(TOKEN_KEY);
  } catch {
    value = undefined;
  }
  if (!isPlausibleToken(value)) {
    const err = new Error('No stored IS session') as Error & { sessionExpired?: boolean };
    err.sessionExpired = true;
    throw err;
  }
  return value;
}

export async function clearStoredToken(): Promise<void> {
  await getPlatform().secureStorage.remove(TOKEN_KEY);
}

/**
 * One-shot cleanup for installs upgrading from before the token was encrypted,
 * where it still sits in plain Preferences.
 *
 * Deleted, not migrated. Deletion is the outcome that matters, and copying it
 * across first is a step that can half-succeed and leave the plaintext behind —
 * the exact thing this exists to remove. The cost is one sign-in, and the
 * re-login flow already handles a lapsed session.
 *
 * Failures are swallowed: this runs during boot, and a storage error on a
 * cleanup step must not stop the app from starting. The next launch retries.
 */
export async function purgePlaintextToken(): Promise<void> {
  try {
    await getPlatform().storage.remove(TOKEN_KEY);
  } catch {
    // Intentionally ignored — see above.
  }
}
