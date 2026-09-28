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
 * - Per-field version counters: a mutation bumps its field's version the
 *   moment it applies. `loadFollows()` snapshots every version before its
 *   reads start and, at commit, writes only the fields whose version hasn't
 *   moved since — so a mutation that still manages to land inside the read
 *   window (the load started, then a mutation ran, all before the load's own
 *   reads resolved) is never clobbered by the stale value the load read.
 */

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

/** Called by a user mutation right after it computes and `set()`s its next value. */
export function bumpVersion(field: FollowVersionField): void {
  versions[field] += 1;
}

/** Snapshot taken by `loadFollows()` before its reads start. */
export function snapshotVersions(): Record<FollowVersionField, number> {
  return { ...versions };
}

/** True if nothing bumped `field` between `snapshot` and now. */
export function isUnchangedSince(
  field: FollowVersionField,
  snapshot: Record<FollowVersionField, number>
): boolean {
  return versions[field] === snapshot[field];
}
