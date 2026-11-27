// The look at IS that mendelu_overview and mendelu_refresh share: read what this tool last
// reported (its own record in the store), take the cheap look (overviewGather.ts), refuse an
// answer that is IS failing rather than the student changing, and diff the two, with the ledger
// entries whose source file was replaced or is gone named next to it. Each tool keeps its own
// record, so a change the overview showed at noon is still in the evening digest.
import type { Store } from './store';
import type { ToolCtx } from './tools';
import { gather, type Gathered, type Run } from './overviewGather';
import { diffWorld, holdBack, type Change } from './overviewDiff';
import { parseSnapshot, snapshotOf, type Snapshot, type World } from './overviewRecord';
import { createLedger } from './storeLedger';
import { ledgerChanges } from './ledgerChanges';
import type { LedgerEntry } from './ledgerEntry';

export type Look = {
  /** The record this diff is against; null on a first look. */
  prev: Snapshot | null;
  g: Gathered;
  ledger: LedgerEntry[];
  changes: Change[];
};

type Token = { gen: string | null; at: number };
export const isToken = (t: unknown): t is Token =>
  !!t && typeof t === 'object' && 'gen' in t && 'at' in t;

/** The record at `path`; when there is none, the one at `fallback` (a first refresh after overviews). */
export async function readRecord(store: Store, path: string, fallback?: string) {
  const own = parseSnapshot(await store.readText(path));
  if (own || !fallback) return { prev: own, borrowed: false };
  const other = parseSnapshot(await store.readText(fallback));
  return { prev: other, borrowed: !!other };
}

export async function look(
  store: Store,
  run: Run,
  ctx: ToolCtx,
  now: Date,
  prev: Snapshot | null
): Promise<Look> {
  const g = await gather(run, ctx, now);
  // An empty answer where the record has subjects is IS not answering properly (a login
  // page, a changed layout), not a student who dropped everything: say so, record nothing.
  if (!g.subjects.length && prev && Object.keys(prev.subjects).length) {
    throw new Error('IS Mendelu returned no subjects this time. Try again in a minute.');
  }
  for (const [code, rows] of Object.entries(g.world.points)) {
    if (rows && !rows.length && Object.keys(prev?.points[code] ?? {}).length) {
      delete g.world.points[code];
      g.problems.push(
        `points of ${code}: IS returned none this time, so the earlier record is kept`
      );
    }
  }
  const { entries: ledger } = await createLedger(store).list();
  const diffed = prev ? diffWorld(prev, g.world) : [];
  // A replaced or vanished source file puts its ledger entries in "changed", once, next to the file.
  return { prev, g, ledger, changes: [...diffed, ...ledgerChanges(ledger, diffed)] };
}

/**
 * Records what was reported, only after the answer exists (a failure in between reports the
 * changes again instead of losing them) and only if no forget() ran since the call began.
 * Built on the record as it is now, so a part this call could not read does not undo what
 * another process reported meanwhile. `held` changes are not recorded: the next call reports them.
 */
export async function recordLook(
  store: Store,
  path: string,
  prev: Snapshot | null,
  world: World,
  held: Change[],
  token: unknown,
  opts: { extra?: Record<string, unknown>; patch?: (next: Snapshot) => void } = {}
) {
  const latest = parseSnapshot(await store.readText(path)) ?? prev;
  const snap = snapshotOf(holdBack(prev, world, held), latest);
  opts.patch?.(snap);
  const next = { ...snap, ...opts.extra };
  return store
    .write(path, JSON.stringify(next), isToken(token) ? { after: token.gen } : {})
    .catch(() => false);
}
