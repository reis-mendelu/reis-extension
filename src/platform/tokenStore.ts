import { getPlatform } from './index';
import { isPlausibleToken } from './sessionToken';
import { DemoModeError, isDemoMode } from '../errors/demoMode';

const TOKEN_KEY = 'reis.session.uisAuth';

/**
 * The token, once read, for the life of this context.
 *
 * On Capacitor every authenticated request calls `loadStoredToken`, and one
 * cold sync is ~120 requests — so a run paid ~120 Keychain/Keystore reads
 * across the native bridge before a single byte reached IS (measured in #197).
 * The value itself never rotates: IS issues one UISAuth per login and it stays
 * valid until the session lapses, so there is nothing to re-read for.
 *
 * Memory only, deliberately — this is a cache of the secure store, not a second
 * home for the credential. It dies with the process, and the two things that
 * can invalidate it both go through this module: a re-login writes through
 * `saveStoredToken`, and sign-out or a lapsed session clears through
 * `clearStoredToken`. Nothing outside this file can write the key (see above),
 * which is what makes that guarantee hold.
 */
let memo: string | null = null;

/**
 * Bumped by every write and every clear, so an in-flight read can tell whether
 * the token changed underneath it.
 *
 * Without it there is a real race, not a theoretical one: `loadStoredToken`
 * awaits the secure store, and a sign-out or a re-login can land in that gap.
 * The read would then resolve and cache the value it fetched *before* the
 * change — re-populating the memo with a token the student just signed out of,
 * or clobbering a freshly issued one with the expired token it replaced. Both
 * outlive the process, because nothing re-reads once the memo is warm.
 */
let generation = 0;

/** Drops the cached token. Tests only — the module holds it for the process. */
export function __resetTokenMemoForTests(): void {
  memo = null;
  generation = 0;
}

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
  // Claimed before the write: any read already in flight is now stale, whatever
  // order the two finish in.
  const mine = ++generation;
  await getPlatform().secureStorage.set(TOKEN_KEY, token);
  // After the write, not before: a failed write must not leave the app acting
  // on a token that was never persisted. And only if nothing has happened
  // since — a later save or a sign-out must not be undone by this one landing
  // late.
  if (mine === generation) memo = token;
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
 *
 * The demo-mode check is guarded HERE rather than at each caller (fetchWithAuth,
 * fetchAuthedBytes, personPhoto, openIsFile, useFileActions, inAppLoginDeps).
 * This is the one place every authenticated path converges to actually obtain
 * the token it would send — a per-call-site guard is whack-a-mole (already
 * missed twice: personPhoto and the file-open paths shipped unguarded), while
 * a new call site added tomorrow gets this for free just by calling the only
 * function that can hand it a real credential. The fetchWithAuth /
 * fetchAuthedBytes / openExternal guards stay in place too — failing before
 * this function is even reached is cheaper — but they are defence in depth,
 * not the actual boundary.
 */
export async function loadStoredToken(): Promise<string> {
  // Before the memo, not after: the demo guard is the boundary every
  // authenticated path converges on, and a cached token must not become the way
  // around it for a student who signed in earlier in this session.
  if (isDemoMode()) throw new DemoModeError();

  if (memo !== null) return memo;

  const mine = generation;
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
  // Only when the token has not changed while this read was in flight. The
  // value is still returned either way: it is what the store held when asked,
  // and the caller's request is already in flight too — what must not happen is
  // it becoming the answer for every later request.
  if (mine === generation) memo = value;
  return value;
}

export async function clearStoredToken(): Promise<void> {
  // Before the remove, not after: if the remove throws, the process must
  // already have forgotten the token rather than keep serving it from memory
  // to a student who asked to be signed out. The bump does the same for a read
  // that is mid-flight right now.
  generation++;
  memo = null;
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
