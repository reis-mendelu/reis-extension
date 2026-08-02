import { getPlatform } from './index';
import { isPlausibleToken } from './sessionToken';

export const TOKEN_KEY = 'reis.session.uisAuth';

/**
 * NOTE: on Capacitor this is Preferences (UserDefaults / SharedPreferences),
 * NOT Keychain or Keystore, and UISAuth is a live credential. Acceptable for a
 * debug build; moving to real secure storage is a tracked follow-up that must
 * land before any public release.
 */
export async function saveStoredToken(token: string): Promise<void> {
  await getPlatform().storage.set(TOKEN_KEY, token);
}

/**
 * Throws with `sessionExpired` rather than returning null so callers treat a
 * missing token exactly like a lapsed one — both mean "send the student to
 * login", and a nullable return invites a silent unauthenticated request.
 */
export async function loadStoredToken(): Promise<string> {
  const value = await getPlatform().storage.get(TOKEN_KEY);
  if (!isPlausibleToken(value)) {
    const err = new Error('No stored IS session') as Error & { sessionExpired?: boolean };
    err.sessionExpired = true;
    throw err;
  }
  return value;
}
