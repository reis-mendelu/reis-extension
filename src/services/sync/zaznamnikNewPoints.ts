import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { diffZaznamnik, type NewPoint } from '../../utils/zaznamnik/newPoints';
import { IndexedDBService } from '../storage/IndexedDBService';
import { withKnownStateLock } from './knownStateLock';

/** Subject code → the entries the student has not opened yet. */
export type NewPointsBySubject = Record<string, NewPoint[]>;

/** The 'meta' key holding NewPointsBySubject until each subject is opened. */
export const NEW_POINTS_META_KEY = 'zaznamnik_new_points';

const hasRecords = (z: SubjectZaznamnik | null): z is SubjectZaznamnik =>
  !!z && (z.ph.sections.length > 0 || z.vt.tests.length > 0);

/** Newer entries replace older ones with the same label; the rest stay. */
function merge(into: NewPointsBySubject, add: NewPointsBySubject): NewPointsBySubject {
  const out = { ...into };
  for (const [code, points] of Object.entries(add)) {
    const labels = new Set(points.map((p) => p.label));
    out[code] = [...(out[code] ?? []).filter((p) => !labels.has(p.label)), ...points];
  }
  return out;
}

async function persist(batch: Record<string, SubjectZaznamnik | null>) {
  // A failure or an empty page never replaces records (setZaznamnikBatch keeps
  // the old ones on screen for the same reason), so it is never compared either.
  const entries = Object.entries(batch).filter((e): e is [string, SubjectZaznamnik] =>
    hasRecords(e[1])
  );
  const found: NewPointsBySubject = {};
  const previous = await Promise.all(
    entries.map(([code]) => IndexedDBService.get('zaznamnik', code))
  );
  const at = Date.now();
  entries.forEach(([code, fresh], i) => {
    const points = diffZaznamnik(previous[i], fresh);
    if (points.length > 0) found[code] = points.map((p) => ({ ...p, at }));
  });
  const stored = ((await IndexedDBService.get('meta', NEW_POINTS_META_KEY)) ??
    {}) as NewPointsBySubject;
  const isNews = Object.keys(found).length > 0;
  const unseen = isNews ? merge(stored, found) : stored;
  // One transaction: a save interrupted between the fresh copy and the entry
  // would leave the copy saying "already seen" and the points announced nowhere.
  await IndexedDBService.setAcross([
    ...entries.map(([key, value]) => ({ store: 'zaznamnik' as const, key, value })),
    ...(isNews ? [{ store: 'meta' as const, key: NEW_POINTS_META_KEY, value: unseen }] : []),
  ]);
  return { found, unseen };
}

// One at a time: a sync posts several messages, and two overlapping runs would
// both compare against the old copy and announce the same points twice.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Stores a sync's záznamník batch, and says what is new since the stored copy:
 * `found` for this batch alone (what to notify about), `unseen` for everything
 * not opened yet (what to highlight). Nothing here leaves the device.
 */
export function persistZaznamnikBatch(
  batch: Record<string, SubjectZaznamnik | null>
): Promise<{ found: NewPointsBySubject; unseen: NewPointsBySubject }> {
  const run = queue.then(() => withKnownStateLock(() => persist(batch)));
  queue = run.catch(() => undefined);
  return run;
}

/**
 * The student opened this subject's záznamník. On the same queue as the
 * persist, so a sync landing at that moment cannot write the entry back.
 */
export function clearNewPoints(courseCode: string): Promise<NewPointsBySubject> {
  const run = queue.then(() =>
    withKnownStateLock(async () => {
      const stored = ((await IndexedDBService.get('meta', NEW_POINTS_META_KEY)) ??
        {}) as NewPointsBySubject;
      if (!(courseCode in stored)) return stored;
      const { [courseCode]: _seen, ...rest } = stored;
      await IndexedDBService.set('meta', NEW_POINTS_META_KEY, rest);
      return rest;
    })
  );
  queue = run.catch(() => undefined);
  return run;
}
