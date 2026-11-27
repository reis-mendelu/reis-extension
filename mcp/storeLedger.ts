// The ledger on disk (decision 9 of the map): one small file per event, ledger/<id>.json,
// written only through the store (atomic, generation-checked, memory-only fallback, size
// budget). One file per event, not one list, because Desktop and every Claude Code window
// share the folder: two adds at once each write their own file, and nothing is read, changed
// and written back over another process's add. The ids are made here and never change, so a
// calendar entry that carries one can be found again later.
import { randomBytes } from 'node:crypto';
import type { Store } from './store';
import { parseFields, parseStored } from './ledgerFields';
import {
  ID,
  MAX_ENTRIES,
  LedgerInputError,
  dayNumber,
  finish,
  type LedgerEntry,
} from './ledgerEntry';

export const pathOf = (id: string) => `ledger/${id}.json`;
const FILE = /^ledger\/(ev-[0-9a-f]{12})\.json$/;
/** A finished event is kept this long past its day, so "what was that test" still has an answer. */
const KEEP_PAST_DAYS = 30;

const byDate = (a: LedgerEntry, b: LedgerEntry) =>
  `${a.date} ${a.time ?? '00:00'} ${a.id}`.localeCompare(`${b.date} ${b.time ?? '00:00'} ${b.id}`);

/** A title as the dedupe reads it: case, accents and spacing do not make another event. */
const titleKey = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Where an event stands in the store, for the dedupe: the same thing read twice is one entry. The
 * title is part of it, because one file can name several tests of a subject in the same week.
 */
const sameEvent = (e: LedgerEntry) =>
  [e.code ?? '', e.kind, e.date, e.time ?? '', e.sourceUrl ?? '', titleKey(e.title)].join('|');

type Raw = Record<string, unknown>;
const queues = new WeakMap<Store, Promise<unknown>>();

export function createLedger(
  store: Store,
  now: () => number = Date.now,
  max: number = MAX_ENTRIES
) {
  /**
   * One change at a time: first per store in this process, then per folder across processes
   * (a lock file). The cap and the dedupe read the whole list, and an update reads one entry
   * and writes it back, so two processes in between would lose one side.
   */
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = (queues.get(store) ?? Promise.resolve()).then(
      () => store.exclusive('ledger', fn),
      () => store.exclusive('ledger', fn)
    );
    queues.set(
      store,
      run.catch(() => {})
    );
    return run;
  };

  async function list(): Promise<{ entries: LedgerEntry[]; unreadable: number }> {
    const ids = (await store.listFolder('ledger')).flatMap((e) => FILE.exec(e.path)?.[1] ?? []);
    const read = await Promise.all(
      ids.map(async (id) => parseStored(await store.readText(pathOf(id))))
    );
    const entries = read.filter((e): e is LedgerEntry => !!e && ID.test(e.id)).sort(byDate);
    return { entries, unreadable: read.length - entries.length };
  }

  async function put(entry: LedgerEntry, gen: string | null) {
    const kept = await store.write(pathOf(entry.id), JSON.stringify(entry), { after: gen });
    if (!kept)
      throw new Error(
        'The entry was not saved: reIS’s folder is full, or everything was forgotten while this ran. Try again.'
      );
  }

  /**
   * Drops events that ended long ago, so a full ledger frees itself. Only called when the
   * ledger is full: an event Claude saved is not thrown away while there is room, so "what was
   * that test" keeps its answer. `today` is the Prague day, YYYY-MM-DD.
   */
  async function prune(entries: LedgerEntry[], today: string) {
    const limit = dayNumber(today) - KEEP_PAST_DAYS;
    const old = entries.filter((e) => dayNumber(e.until ?? e.date) < limit);
    await Promise.all(old.map((e) => store.remove(pathOf(e.id))));
    return entries.filter((e) => !old.includes(e));
  }

  const stamp = () => new Date(now()).toISOString();

  /**
   * The forget token when Claude asked, read before the change waits its turn: one read after
   * the wait would see the token of a forget that ran meanwhile and save the old request into
   * the emptied folder. Only forget() changes the token, so a queue of ordinary writes is fine.
   */
  const askedUnder = () => store.generation().catch(() => null);

  return {
    list,
    askedUnder,

    /** Saves a new event, or updates the one already saved for the same subject, kind, day, time, file and title. */
    /** `asked`: the forget token taken when the tool call began (askedUnder), if it began earlier. */
    add: (args: Raw, today: string, asked = askedUnder()) =>
      serial(async () => {
        const gen = await asked;
        const fields = parseFields(args);
        const { entries } = await list();
        const probe = finish(fields as Raw, { id: 'ev-000000000000', savedAt: '', updatedAt: '' });
        const twin = entries.find((e) => sameEvent(e) === sameEvent(probe));
        if (twin) return { entry: await merge(twin, fields as Raw, gen), created: false };
        const live = entries.length >= max ? await prune(entries, today) : entries;
        if (live.length >= max)
          throw new LedgerInputError(
            `The ledger holds ${max} events, its limit. Remove finished or wrong ones with action "remove" first.`
          );
        const at = stamp();
        const entry = finish(fields as Raw, {
          id: `ev-${randomBytes(6).toString('hex')}`,
          savedAt: at,
          updatedAt: at,
        });
        await put(entry, gen);
        return { entry, created: true };
      }),

    /** Changes the fields given; an empty string clears one. The id and the saved date stay. */
    update: (id: string, args: Raw, asked = askedUnder()) =>
      serial(async () => {
        const gen = await asked;
        if (!ID.test(id))
          throw new LedgerInputError('id must be an event id such as ev-0123456789ab.');
        const old = parseStored(await store.readText(pathOf(id)));
        if (!old)
          throw new LedgerInputError(`No ledger entry ${id}. Use action "list" to see the ids.`);
        return merge(old, parseFields(args) as Raw, gen);
      }),

    /** True if there was such an entry. */
    remove: (id: string) =>
      serial(async () => {
        if (!ID.test(id))
          throw new LedgerInputError('id must be an event id such as ev-0123456789ab.');
        const had = !!(await store.read(pathOf(id)));
        await store.remove(pathOf(id));
        return had;
      }),
  };

  async function merge(old: LedgerEntry, patch: Raw, gen: string | null) {
    const next: Raw = { ...old };
    for (const [k, v] of Object.entries(patch)) next[k] = v;
    // Saying a date is stated, not inferred, retires how it was inferred.
    if (patch.basis === 'stated' && patch.inferredHow === undefined) delete next.inferredHow;
    const entry = finish(next, { id: old.id, savedAt: old.savedAt, updatedAt: stamp() });
    await put(entry, gen);
    return entry;
  }
}
