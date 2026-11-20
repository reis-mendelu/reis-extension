import { IndexedDBService } from '../storage/IndexedDBService';
import { withKnownStateLock } from './knownStateLock';

/**
 * The 'meta' key holding the new exam terms the student has not looked at:
 * found by `persistExamTerms` (newExamTerms.ts), cleared when Zkoušky opens.
 * Its own record beside the known set, which only says what is new on ONE
 * sync — a Novinky row has to outlive the sync that found it.
 */
export const NEW_TERMS_META_KEY = 'exam_terms_new';

const read = async () =>
  ((await IndexedDBService.get('meta', NEW_TERMS_META_KEY)) ?? []) as string[];

// One at a time, like the known set: a clear between an add's read and its
// write would be undone by it.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(() => withKnownStateLock(job));
  queue = run.catch(() => undefined);
  return run;
}

/** Adds a sync's new terms. Answers every term still unseen. */
export function addUnseenTerms(keys: string[]): Promise<string[]> {
  return enqueue(async () => {
    const stored = await read();
    if (keys.every((k) => stored.includes(k))) return stored;
    const next = [...new Set([...stored, ...keys])];
    await IndexedDBService.set('meta', NEW_TERMS_META_KEY, next);
    return next;
  });
}

/** The unseen terms, read in turn with the writes. */
export function readUnseenTerms(): Promise<string[]> {
  return enqueue(read);
}

/**
 * The student opened Zkoušky: these terms have been on screen. Only these:
 * another extension tab shares this record but not its store, and may have
 * added a term this one never showed. Answers what is still unseen.
 */
export function clearUnseenTerms(shown: string[]): Promise<string[]> {
  return enqueue(async () => {
    const drop = new Set(shown);
    const stored = await read();
    if (!stored.some((k) => drop.has(k))) return stored;
    const rest = stored.filter((k) => !drop.has(k));
    await IndexedDBService.set('meta', NEW_TERMS_META_KEY, rest);
    return rest;
  });
}

/** Another study: its terms are not this one's news. */
export function resetUnseenTerms(): Promise<void> {
  return enqueue(() => IndexedDBService.delete('meta', NEW_TERMS_META_KEY));
}
