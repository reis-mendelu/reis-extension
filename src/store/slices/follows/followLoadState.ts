/**
 * Module-level bookkeeping shared by every caller into `createFollowSlice`'s
 * `loadFollows()`/`retryFollowsIfUnresolved()`/mutation actions.
 *
 * Module-level (not per-slice-instance) on purpose, same reasoning as the
 * `followsLoadInFlight` flag this replaces: there is exactly one store
 * instance, so a plain module variable is simpler than threading this through
 * `set`/`get`. This file must not import `useAppStore` — it lives under
 * `store/slices/follows/` specifically so `createFollowSlice.ts` can import
 * it without a require cycle (`useAppStore -> createFollowSlice -> here`).
 *
 * Two responsibilities, both from the same CodeRabbit finding on PR #475:
 * `loadFollows()` awaits two IndexedDB reads and then sets
 * followed/muted/notifyPrefs/permissionAsked wholesale, so a user action
 * landing during that window used to get silently overwritten by the older
 * disk snapshot — worst case, `toggleFollow()` computing from the cold-boot
 * `followed: []` default and persisting a one-element list over the
 * student's real saved follows.
 *
 * - `runExclusiveLoad`/`awaitInFlightLoad`: at most one real load body runs
 *   at a time (unchanged from before), and any mutation can await whichever
 *   one is already running instead of computing from the pre-load defaults.
 * - `ensureLoaded`: a mutation that runs before any load has COMMITTED
 *   (Tier 2 awaits three hydrate reads before it fires `loadFollows()`, and
 *   nothing gates the follow chip on `followsLoaded`) starts — or joins — the
 *   load itself rather than computing from the cold defaults.
 * - Per-field version counters plus a pending-write count. `loadFollows()`
 *   snapshots every version before its reads start and, at commit, writes
 *   only the fields that no mutation touched since AND that no mutation is
 *   still persisting. A mutation bumps its field's version both when it
 *   applies and again once its writes settle: a load that started mid-write
 *   read disk before the write landed, and the second bump is what tells its
 *   commit that what it read is already stale. The pending count covers the
 *   same load committing before the write has settled at all.
 */

import { logError } from '../../../utils/reportError';

let inFlight: Promise<void> | null = null;

/** Awaits whatever load is currently running; a no-op if none is. */
export async function awaitInFlightLoad(): Promise<void> {
  if (inFlight) await inFlight;
}

/**
 * Runs `body` as the one real load, sharing it with any concurrent caller —
 * the same dedupe `followsLoadInFlight` used to provide, just factored out so
 * mutations can also see (and await) whatever is in flight.
 */
export async function runExclusiveLoad(body: () => Promise<void>): Promise<void> {
  if (!inFlight) {
    inFlight = body().finally(() => {
      inFlight = null;
    });
  }
  await inFlight;
}

export type FollowVersionField = 'followed' | 'muted' | 'notifyPrefs' | 'permissionAsked';

const versions: Record<FollowVersionField, number> = {
  followed: 0,
  muted: 0,
  notifyPrefs: 0,
  permissionAsked: 0,
};

const pendingWrites: Record<FollowVersionField, number> = {
  followed: 0,
  muted: 0,
  notifyPrefs: 0,
  permissionAsked: 0,
};

/**
 * Before a mutation computes its next value: joins the load in flight, or —
 * when no load has committed yet — runs one. `followsLoaded` is set only by a
 * load's commit, so it is exactly "memory holds what disk said". Once it is
 * true an unresolved list stays `retryFollowsIfUnresolved`'s business; this
 * never triggers a second load of its own.
 */
export async function ensureLoaded(
  get: () => { followsLoaded: boolean; loadFollows: () => Promise<void> }
): Promise<void> {
  if (!get().followsLoaded) await get().loadFollows();
  else await awaitInFlightLoad();
}

/**
 * `ensureLoaded` for a mutation of `muted`/`notifyPrefs`, whose next value is
 * computed from the current one. If the settings read failed, that value is
 * the defaults, not the student's: retry the read once, and return whether
 * it has now worked — false means keep the change in memory only (no
 * `persistField`, so the next good read replaces it with what disk holds).
 */
export async function ensureNotifySettingsRead(
  get: () => {
    followsLoaded: boolean;
    notifySettingsRead: boolean;
    loadFollows: () => Promise<void>;
  }
): Promise<boolean> {
  await ensureLoaded(get);
  if (!get().notifySettingsRead) await get().loadFollows();
  return get().notifySettingsRead;
}

/**
 * Persists a mutation's new value. Call it synchronously right after the
 * mutation's `set()`, so the version moves in the same tick as memory does.
 * A failed write is logged, not thrown: memory already holds the choice.
 */
export async function persistField(
  field: FollowVersionField,
  context: string,
  write: () => Promise<unknown>
): Promise<void> {
  versions[field] += 1;
  pendingWrites[field] += 1;
  try {
    await write();
  } catch (err) {
    logError(context, err);
  } finally {
    pendingWrites[field] -= 1;
    versions[field] += 1;
  }
}

/** Snapshot taken by `loadFollows()` before its reads start. */
export function snapshotVersions(): Record<FollowVersionField, number> {
  return { ...versions };
}

/** True if no mutation touched `field` since `snapshot`, and none is still writing it. */
export function isUnchangedSince(
  field: FollowVersionField,
  snapshot: Record<FollowVersionField, number>
): boolean {
  return versions[field] === snapshot[field] && pendingWrites[field] === 0;
}
