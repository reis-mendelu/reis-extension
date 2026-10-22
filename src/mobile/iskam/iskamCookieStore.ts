import { getPlatform } from '../../platform';
import { SignOutBlockedError } from '../signOutCleanups';
import { isIskamCookie, type IskamJar } from './iskamJar';

const KEY = 'reis.iskam.jar';
/**
 * A non-secret flag in plain `platform.storage`, set when a sign-out could not
 * remove the jar from the secure store. While it is set the jar is treated as
 * gone, so the next student on the device never gets the previous one's
 * WebISKAM login; the next successful save or removal lifts it.
 */
const REVOKED = 'reis.iskam.revoked';

/**
 * The ONLY module that writes the WebISKAM login to disk.
 *
 * The jar authenticates as the student on WebISKAM and, through the alibaba
 * cookies, on the MENDELU IdP — so it lives in `platform.secureStorage`
 * (Keychain / Keystore AES-GCM), never in `platform.storage`, which is
 * plaintext Preferences. Keeping the key private to this file is what stops a
 * second writer from appearing.
 *
 * The ordering rules are tokenStore's, for the same race: a silent refresh
 * started before a sign-out can finish after it. `basedOn` is the generation a
 * caller read at; a write or clear based on a generation something has since
 * moved past is DROPPED, so a late refresh cannot resurrect cookies the student
 * signed out of, and a late "dead" verdict cannot wipe a login that just
 * succeeded. Writes go through one lane, so they reach the store in order.
 */
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();

function serialized<T>(op: () => Promise<T>): Promise<T> {
  const next = writes.then(op, op);
  writes = next.catch(() => undefined);
  return next;
}

export function jarGeneration(): number {
  return generation;
}

/**
 * Through the write lane too: a read issued while a sign-out's remove is still
 * landing must see the cleared store, not the jar it is about to delete.
 */
export async function loadJar(): Promise<IskamJar> {
  if (await isRevoked()) {
    // Try the removal the sign-out could not do; the jar stays unusable either way.
    await serialized(() => getPlatform().secureStorage.remove(KEY))
      .then(() => liftRevocation())
      .catch(() => undefined);
    return [];
  }
  // A failed READ is not "no login" — the Keychain/Keystore may answer next
  // time. It throws, and the chain reports unreachable instead of a popup.
  const raw: unknown = await serialized(() => getPlatform().secureStorage.get(KEY));
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isIskamCookie) : [];
  } catch {
    return [];
  }
}

/** Throws when the flag cannot be read: an unknown revocation fails closed. */
async function isRevoked(): Promise<boolean> {
  return (await getPlatform().storage.get(REVOKED)) === '1';
}

async function liftRevocation(): Promise<void> {
  try {
    await getPlatform().storage.remove(REVOKED);
  } catch {
    // The flag only ever errs towards "no login"; a stale one costs a sign-in.
  }
}

export async function saveJar(jar: IskamJar, basedOn?: number): Promise<number | null> {
  if (basedOn !== undefined && basedOn !== generation) return null;
  const mine = ++generation;
  await serialized(() => getPlatform().secureStorage.set(KEY, JSON.stringify(jar)));
  await liftRevocation();
  return mine;
}

export async function clearJar(basedOn?: number): Promise<boolean> {
  if (basedOn !== undefined && basedOn !== generation) return false;
  generation++;
  try {
    await serialized(() => getPlatform().secureStorage.remove(KEY));
  } catch (e) {
    // Could not delete it: revoke it instead, then report the failure. If the
    // revocation cannot be written either, the jar is still usable, so the
    // sign-out is blocked rather than allowed to hand the device on.
    try {
      await getPlatform().storage.set(REVOKED, '1');
    } catch (flagError) {
      throw new SignOutBlockedError('WebISKAM login could be neither deleted nor revoked', {
        cause: flagError,
      });
    }
    throw e;
  }
  return true;
}

/** Tests only. */
export function __resetIskamJarForTests(): void {
  generation = 0;
  writes = Promise.resolve();
}
