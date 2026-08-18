/**
 * Foreground poll cadence.
 *
 * Raised from 5 minutes: one full run is ~120 IS requests, and nothing it
 * fetches moves faster than this — grades, submissions and exam terms are the
 * only genuinely volatile resources, and none of them changes minute to minute.
 * The `syncTtl` tiers mean a tick past the first costs only that hot set.
 */
export const SYNC_INTERVAL = 15 * 60 * 1000;

/**
 * Floor between two runs nobody asked for, whatever triggered them.
 *
 * Three independent automatic triggers exist — this interval, the background
 * alarm poke, and the mobile `resume` event — and none of them knew about the
 * others, so tabbing away and back used to cost a full crawl on top of a tick
 * that had just finished. An explicit refresh is never subject to this.
 */
export const MIN_SYNC_GAP = 10 * 60 * 1000;

/**
 * Web Locks name shared by every is.mendelu.cz context. Each open IS tab runs
 * its own content script with its own timer, so without a lease N tabs meant N
 * simultaneous full crawls. The lock is per-origin, which is exactly the scope
 * that needs coordinating.
 */
export const SYNC_LOCK_NAME = 'reis-sync';

/**
 * How long an explicit refresh queues behind whichever context holds the lock
 * before going ahead regardless. Bounded because a wedged holder must not turn
 * a refresh the student asked for into silence.
 */
export const SYNC_LOCK_WAIT_MS = 60 * 1000;

export const IFRAME_ID = 'reis-app-frame';
