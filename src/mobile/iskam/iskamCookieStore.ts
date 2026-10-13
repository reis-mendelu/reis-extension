import { getPlatform } from '../../platform';
import { isIskamCookie, type IskamJar } from './iskamJar';

const KEY = 'reis.iskam.jar';

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
  let raw: unknown;
  try {
    raw = await serialized(() => getPlatform().secureStorage.get(KEY));
  } catch {
    return [];
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isIskamCookie) : [];
  } catch {
    return [];
  }
}

export async function saveJar(jar: IskamJar, basedOn?: number): Promise<number | null> {
  if (basedOn !== undefined && basedOn !== generation) return null;
  const mine = ++generation;
  await serialized(() => getPlatform().secureStorage.set(KEY, JSON.stringify(jar)));
  return mine;
}

export async function clearJar(basedOn?: number): Promise<boolean> {
  if (basedOn !== undefined && basedOn !== generation) return false;
  generation++;
  await serialized(() => getPlatform().secureStorage.remove(KEY));
  return true;
}

/** Tests only. */
export function __resetIskamJarForTests(): void {
  generation = 0;
  writes = Promise.resolve();
}
