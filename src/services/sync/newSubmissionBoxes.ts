import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxKey, findNewBoxes, type KnownBoxes } from '../../utils/newSubmissionBoxes';
import { IndexedDBService } from '../storage/IndexedDBService';

/**
 * The 'meta' key holding every box id and IS period this device has seen. Its
 * own record, not the stored box list: on the phone the sync writes that list
 * itself, before the push arrives, so comparing with it would find nothing.
 */
export const KNOWN_BOXES_META_KEY = 'odevzdavarny_known';

/** The 'meta' key holding the new boxes whose subject the student has not opened. */
export const NEW_BOXES_META_KEY = 'odevzdavarny_new';

interface StoredKnown {
  ids: string[];
  periods: string[];
}

async function persist(fresh: Odevzdavarna[], obdobi: string) {
  const [stored, unseenBefore] = (await Promise.all([
    IndexedDBService.get('meta', KNOWN_BOXES_META_KEY),
    IndexedDBService.get('meta', NEW_BOXES_META_KEY),
  ])) as [StoredKnown | undefined, string[] | undefined];
  const known: KnownBoxes | undefined = stored && {
    ids: new Set(stored.ids),
    periods: new Set(stored.periods),
  };
  const found = findNewBoxes(known, fresh, obdobi, Date.now());
  const freshKeys = fresh.map(boxKey);
  // Only ever added to: a partial or stale list can miss a box for one push,
  // and a box that comes back is not new again. The push's own period counts
  // even with no boxes in it, so the first box of an empty semester is news.
  const next: StoredKnown = {
    ids: [...new Set([...(stored?.ids ?? []), ...freshKeys])],
    periods: [
      ...new Set([...(stored?.periods ?? []), obdobi, ...fresh.flatMap((b) => b.obdobi ?? [])]),
    ],
  };
  // A box that left IS takes its row with it.
  const present = new Set(freshKeys);
  const unseen = [...new Set([...(unseenBefore ?? []), ...found])].filter((k) => present.has(k));
  // One transaction: the ids marked known and the ones still to announce land together.
  await IndexedDBService.setAcross([
    { store: 'meta', key: KNOWN_BOXES_META_KEY, value: next },
    { store: 'meta', key: NEW_BOXES_META_KEY, value: unseen },
  ]);
  return { found, unseen };
}

// One at a time: two overlapping pushes would both read the old known record
// and announce the same box twice; a clear or a reset between a persist's read
// and its write would be undone by it.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Remembers a sync's box list for period `obdobi`, and says what is new since
 * this device last saw one: `found` for this push, `unseen` for every new box
 * whose subject has not been opened since. Nothing here leaves the device.
 */
export function persistNewBoxes(
  fresh: Odevzdavarna[],
  obdobi: string
): Promise<{ found: string[]; unseen: string[] }> {
  return enqueue(() => persist(fresh, obdobi));
}

/** The new boxes still unseen, read in turn with the writes. */
export function readNewBoxes(): Promise<string[]> {
  return enqueue(
    async () => ((await IndexedDBService.get('meta', NEW_BOXES_META_KEY)) ?? []) as string[]
  );
}

/** The student opened the subject of these boxes. Answers what is still unseen. */
export function clearNewBoxes(keys: string[]): Promise<string[]> {
  return enqueue(async () => {
    const stored = ((await IndexedDBService.get('meta', NEW_BOXES_META_KEY)) ?? []) as string[];
    const drop = new Set(keys);
    if (!stored.some((k) => drop.has(k))) return stored;
    const rest = stored.filter((k) => !drop.has(k));
    await IndexedDBService.set('meta', NEW_BOXES_META_KEY, rest);
    return rest;
  });
}

/** Another study: forget every box, so its first sync is a fresh baseline. */
export function resetNewBoxes(): Promise<void> {
  return enqueue(async () => {
    await Promise.all([
      IndexedDBService.delete('meta', KNOWN_BOXES_META_KEY),
      IndexedDBService.delete('meta', NEW_BOXES_META_KEY),
    ]);
  });
}
