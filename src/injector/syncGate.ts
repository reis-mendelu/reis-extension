import { syncAllData } from './syncService';
import { MIN_SYNC_GAP, SYNC_INTERVAL, SYNC_LOCK_NAME, SYNC_LOCK_WAIT_MS } from './config';
import { resetSyncTtl } from './syncTtl';

/**
 * The one gate every sync passes through.
 *
 * Four triggers used to call `syncAllData` directly and unconditionally — boot,
 * the interval, the background alarm poke, and the mobile `resume` event — so a
 * student who tabbed away for ten seconds paid a second full crawl, and one
 * with three IS tabs open paid three at once. Nothing asked whether there was a
 * reason to sync. This module is that question, asked once for all of them.
 *
 * Shared by the extension content script and the Capacitor app, which run the
 * same `syncAllData`.
 */
export type SyncReason = 'boot' | 'tick' | 'poke' | 'resume' | 'user';

/** Runs nobody asked for: subject to the minimum gap. */
const AUTOMATIC: ReadonlySet<SyncReason> = new Set(['tick', 'poke', 'resume']);

/**
 * Runs that must not fire at a student who cannot see the result.
 *
 * `resume` is deliberately absent: Capacitor fires it as the app returns to the
 * foreground, and the WebView can still report `hidden` at that instant, so
 * consulting visibility there would drop the one automatic run that always has
 * someone watching.
 */
const VISIBILITY_GATED: ReadonlySet<SyncReason> = new Set(['tick', 'poke']);

let lastRunAt = 0;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * The run happening right now in THIS context, if any.
 *
 * The Web Lock coordinates across tabs, but two triggers inside one context can
 * still collide — `startSyncService()` and the iframe's first `REQUEST_DATA`
 * both fire `boot`, and they overlap by design. `syncAllData`'s own `isSyncing`
 * guard used to absorb the second as a no-op; once boot queues for a lock it
 * would instead wait and then run a redundant second crawl. This is what makes
 * the second one join the first rather than repeat it.
 */
let inFlight: Promise<void> | null = null;

/**
 * A full crawl — `boot` or `user` — queued or running in this context.
 *
 * Both reasons mean "fetch everything, now", so a second such request joins
 * this one instead of running another: two full crawls back to back return the
 * same data twice as slowly. Automatic runs are deliberately excluded, because
 * they are partial (the hot tier only) and so can never satisfy a request for
 * everything.
 *
 * Spans the wait for the cross-tab lock as well as the run itself. `inFlight`
 * alone is not enough — it is set when `run` starts, and a request still queued
 * behind another tab's lock has not reached `run` yet, so a second one would
 * sail past and queue its own redundant crawl.
 */
let fullCrawl: Promise<boolean> | null = null;

export function __resetSyncGateForTests(): void {
  lastRunAt = 0;
  inFlight = null;
  fullCrawl = null;
  resetSyncTtl();
}

function isForeground(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/** Starts a run and stamps the attempt. Failures are already reported by
 *  `syncAllData` itself; they still count against the gap so a broken IS is
 *  not retried in a tight loop. */
async function run(reason: SyncReason): Promise<true> {
  lastRunAt = Date.now();
  // Cleared here, not in requestSync: the stamps must be dropped immediately
  // before the run that belongs to them. Resetting earlier let a run already in
  // flight re-stamp resources afterwards, and the refresh the student asked for
  // then skipped every one of them.
  //
  // `boot` clears them too. In a fresh context the map is already empty, so this
  // is a no-op — but it also makes "a full crawl fetches everything" true by
  // construction, which is what lets a `user` request join a `boot` instead of
  // running a second crawl behind it.
  if (reason === 'boot' || reason === 'user') resetSyncTtl();

  const active = (async () => {
    try {
      await syncAllData();
    } catch {
      /* syncAllData reports its own failures to the iframe */
    }
  })();
  inFlight = active;
  try {
    await active;
  } finally {
    if (inFlight === active) inFlight = null;
  }
  return true;
}

/** Resolves to whether a run was started. */
async function runUnderLock(reason: SyncReason): Promise<boolean> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return run(reason); // no Web Locks (older WebView, tests) — nothing to coordinate

  if (AUTOMATIC.has(reason)) {
    // Another IS tab is mid-crawl: skip this round rather than duplicate it.
    // Timers are per-tab and independent, so the next tick is a fresh contest.
    const started = await locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) =>
      lock ? run(reason) : false
    );
    return started === true;
  }

  // boot / user: someone is waiting on this, so queue behind the leader instead
  // of dropping it — bounded, then go ahead anyway.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_LOCK_WAIT_MS);
  try {
    await locks.request(SYNC_LOCK_NAME, { signal: controller.signal }, () => run(reason));
    return true;
  } catch {
    return run(reason);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask for a sync. Returns whether one was actually started.
 *
 * `user` is the escape hatch that makes the TTL tiers safe to be aggressive
 * about: an explicit refresh clears every freshness stamp, so nothing is
 * answered from cache on the student's behalf.
 */
export async function requestSync(reason: SyncReason): Promise<boolean> {
  if (VISIBILITY_GATED.has(reason) && !isForeground()) return false;

  // Read once, synchronously, so two triggers in the same tick cannot both see
  // this empty and each start a crawl.
  const active = inFlight ?? fullCrawl;

  if (AUTOMATIC.has(reason)) {
    // Something already owns this round — matches what the cross-tab lock does,
    // and holds even where Web Locks are unavailable.
    if (active) return false;
    if (Date.now() - lastRunAt < MIN_SYNC_GAP) return false;
    return runUnderLock(reason);
  }

  // boot and user both mean "everything, now", so one already under way answers
  // this request in full. Joining it hands the student data after one crawl
  // instead of two, and inherits that crawl's bounded lock wait rather than
  // stacking a second one on top of it.
  if (fullCrawl) {
    await fullCrawl;
    return false;
  }

  // Only a partial automatic run is going: let it finish, then do a real run,
  // because the hot tier alone is not what was asked for.
  if (inFlight) await inFlight;
  return trackFullCrawl(reason);
}

/** Publishes a full crawl for the whole of its life — lock wait included — so
 *  another `boot` or `user` request can join it rather than start a second. */
async function trackFullCrawl(reason: SyncReason): Promise<boolean> {
  const attempt = runUnderLock(reason);
  fullCrawl = attempt;
  try {
    return await attempt;
  } finally {
    if (fullCrawl === attempt) fullCrawl = null;
  }
}

export function startSyncService(): void {
  void requestSync('boot');
  syncIntervalId = setInterval(() => void requestSync('tick'), SYNC_INTERVAL);
}

export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
