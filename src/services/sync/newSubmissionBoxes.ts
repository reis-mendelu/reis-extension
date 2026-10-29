import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxKey, findNewBoxes } from '../../utils/newSubmissionBoxes';
import { IndexedDBService } from '../storage/IndexedDBService';

/**
 * The 'meta' key holding every box id this device has seen. Its own list, not
 * the stored box list: on the phone the sync writes that list itself, before
 * the push arrives, so comparing with it would never find anything new.
 */
export const KNOWN_BOXES_META_KEY = 'odevzdavarny_known';

/** The 'meta' key holding the new boxes whose subject the student has not opened. */
export const NEW_BOXES_META_KEY = 'odevzdavarny_new';

async function persist(fresh: Odevzdavarna[]) {
  const [known, stored] = (await Promise.all([
    IndexedDBService.get('meta', KNOWN_BOXES_META_KEY),
    IndexedDBService.get('meta', NEW_BOXES_META_KEY),
  ])) as [string[] | undefined, string[] | undefined];
  const freshKeys = fresh.map(boxKey);
  const found = findNewBoxes(known ? new Set(known) : undefined, fresh, Date.now());
  // Only ever added to: a partial or stale list can miss a box for one push,
  // and a box that comes back is not new again.
  const nextKnown = [...new Set([...(known ?? []), ...freshKeys])];
  // A box that left IS takes its row with it.
  const present = new Set(freshKeys);
  const unseen = [...new Set([...(stored ?? []), ...found])].filter((k) => present.has(k));
  // One transaction: the ids marked known and the ones still to announce land together.
  await IndexedDBService.setAcross([
    { store: 'meta', key: KNOWN_BOXES_META_KEY, value: nextKnown },
    { store: 'meta', key: NEW_BOXES_META_KEY, value: unseen },
  ]);
  return { found, unseen };
}

// One at a time: two overlapping pushes would both read the old known list
// and announce the same box twice.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Remembers a sync's box list, and says what is new since this device last
 * saw one: `found` for this push, `unseen` for every new box whose subject has
 * not been opened since. Nothing here leaves the device.
 */
export function persistNewBoxes(
  fresh: Odevzdavarna[]
): Promise<{ found: string[]; unseen: string[] }> {
  const run = queue.then(() => persist(fresh));
  queue = run.catch(() => undefined);
  return run;
}

/** The student opened the subject of these boxes. On the persist's queue. */
export function clearNewBoxes(keys: string[]): Promise<string[]> {
  const run = queue.then(async () => {
    const stored = ((await IndexedDBService.get('meta', NEW_BOXES_META_KEY)) ?? []) as string[];
    const drop = new Set(keys);
    if (!stored.some((k) => drop.has(k))) return stored;
    const rest = stored.filter((k) => !drop.has(k));
    await IndexedDBService.set('meta', NEW_BOXES_META_KEY, rest);
    return rest;
  });
  queue = run.catch(() => undefined);
  return run;
}
