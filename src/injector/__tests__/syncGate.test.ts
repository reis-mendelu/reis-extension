import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSync, __resetSyncGateForTests } from '../syncGate';
import { MIN_SYNC_GAP, SYNC_LOCK_WAIT_MS } from '../config';
import { syncAllData } from '../syncService';
import { isFresh, markFetched, TTL } from '../syncTtl';

/** A sync that blocks until released, so a second request can land mid-run. */
function blockingSync() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release() };
}

vi.mock('../syncService', () => ({ syncAllData: vi.fn(async () => {}) }));

const mockedSync = vi.mocked(syncAllData);

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/** A Web Locks stand-in. `held` models another IS tab already syncing. */
function installLocks(held: boolean) {
  const granted: string[] = [];
  const locks = {
    request: vi.fn(
      async (
        name: string,
        options: { ifAvailable?: boolean; signal?: AbortSignal },
        callback: (lock: unknown) => Promise<unknown>
      ) => {
        if (held && options.ifAvailable) return callback(null);
        if (held && options.signal) {
          // Model a leader that never lets go, so the waiter hits its bound.
          return new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new Error('AbortError')));
          });
        }
        granted.push(name);
        return callback({ name });
      }
    ),
  };
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return locks;
}

/**
 * A Web Locks stand-in that really queues: another tab holds the lock until
 * `releaseHolder()`, and waiting requests are then granted one at a time. The
 * simpler `installLocks` fake cannot show this, because it never models the
 * window where a request is queued but has not yet run.
 */
function installQueuingLocks() {
  let releaseHolder!: () => void;
  let chain: Promise<unknown> = new Promise<void>((resolve) => {
    releaseHolder = resolve;
  });
  const locks = {
    request: vi.fn(
      async (
        name: string,
        options: { ifAvailable?: boolean },
        callback: (lock: unknown) => Promise<unknown>
      ) => {
        if (options.ifAvailable) return callback(null); // held by the other tab
        const mine = chain.then(() => callback({ name }));
        chain = mine.catch(() => undefined);
        return mine;
      }
    ),
  };
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return { releaseHolder: () => releaseHolder() };
}

describe('requestSync', () => {
  beforeEach(() => {
    __resetSyncGateForTests();
    mockedSync.mockClear();
    mockedSync.mockImplementation(async () => {});
    setVisibility('visible');
    // Default: no Web Locks (happy-dom, older WebViews) — must not block a sync.
    Reflect.deleteProperty(navigator, 'locks');
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'locks');
    setVisibility('visible');
  });

  describe('foreground gate', () => {
    it.each(['tick', 'poke'] as const)(
      'drops an automatic %s while the tab is in the background',
      async (reason) => {
        setVisibility('hidden');
        await expect(requestSync(reason)).resolves.toBe(false);
        expect(mockedSync).not.toHaveBeenCalled();
      }
    );

    // Capacitor fires `resume` as the app returns; the WebView can still report
    // hidden at that instant, so resume is treated as foreground by definition.
    it('runs a resume even while the document still reports hidden', async () => {
      setVisibility('hidden');
      await expect(requestSync('resume')).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    it.each(['boot', 'user'] as const)('never drops %s on visibility', async (reason) => {
      setVisibility('hidden');
      await expect(requestSync(reason)).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('minimum gap between automatic runs', () => {
    it('collapses a poke landing right behind an interval tick', async () => {
      vi.useFakeTimers();
      await requestSync('tick');
      expect(mockedSync).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(MIN_SYNC_GAP - 1);
      await expect(requestSync('poke')).resolves.toBe(false);
      await expect(requestSync('resume')).resolves.toBe(false);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    it('lets the next automatic run through once the gap has passed', async () => {
      vi.useFakeTimers();
      await requestSync('tick');
      vi.advanceTimersByTime(MIN_SYNC_GAP);
      await expect(requestSync('tick')).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(2);
    });

    it('honours an explicit refresh inside the gap', async () => {
      vi.useFakeTimers();
      await requestSync('tick');
      vi.advanceTimersByTime(1_000);
      await expect(requestSync('user')).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('explicit refresh', () => {
    it('clears the TTL stamps so nothing is served from cache', async () => {
      markFetched('studyPlan');
      expect(isFresh('studyPlan', TTL.SEMESTER)).toBe(true);
      await requestSync('user');
      expect(isFresh('studyPlan', TTL.SEMESTER)).toBe(false);
    });

    it('leaves the TTL stamps alone for an automatic run', async () => {
      markFetched('studyPlan');
      await requestSync('tick');
      expect(isFresh('studyPlan', TTL.SEMESTER)).toBe(true);
    });
  });

  describe('cross-tab lock', () => {
    it('runs when no other tab holds the lock', async () => {
      const locks = installLocks(false);
      await expect(requestSync('tick')).resolves.toBe(true);
      expect(locks.request).toHaveBeenCalledWith(
        'reis-sync',
        { ifAvailable: true },
        expect.any(Function)
      );
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    // The multiplier this exists to remove: every open is.mendelu.cz tab runs
    // its own content script and its own timer.
    it('drops an automatic run while another tab is already syncing', async () => {
      installLocks(true);
      await expect(requestSync('tick')).resolves.toBe(false);
      expect(mockedSync).not.toHaveBeenCalled();
    });

    it('queues an explicit refresh behind the leader rather than dropping it', async () => {
      const locks = installLocks(false);
      await expect(requestSync('user')).resolves.toBe(true);
      expect(locks.request).toHaveBeenCalledWith(
        'reis-sync',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        expect.any(Function)
      );
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    // A wedged holder must not silently swallow a refresh the student asked for.
    it('runs an explicit refresh anyway when the wait times out', async () => {
      vi.useFakeTimers();
      installLocks(true);
      const pending = requestSync('user');
      await vi.advanceTimersByTimeAsync(SYNC_LOCK_WAIT_MS);
      await expect(pending).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    it('syncs normally where Web Locks are unavailable', async () => {
      await expect(requestSync('tick')).resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('a request landing while a run is already in flight', () => {
    // Regression: startSyncService() and the iframe's first REQUEST_DATA both
    // fire 'boot'. syncAllData's isSyncing guard used to absorb the second as a
    // no-op; queueing for the lock instead would run a redundant second crawl.
    it('joins a boot already under way instead of crawling twice', async () => {
      const { gate, release } = blockingSync();
      mockedSync.mockImplementationOnce(async () => {
        await gate;
      });

      const first = requestSync('boot');
      const second = requestSync('boot');
      release();

      await expect(first).resolves.toBe(true);
      await expect(second, 'the second boot joined rather than started').resolves.toBe(false);
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    it('drops an automatic run while one is already in flight', async () => {
      const { gate, release } = blockingSync();
      mockedSync.mockImplementationOnce(async () => {
        await gate;
      });

      const first = requestSync('boot');
      await expect(requestSync('tick')).resolves.toBe(false);
      release();
      await first;
      expect(mockedSync).toHaveBeenCalledTimes(1);
    });

    // Regression: the reset used to happen before waiting, so the run already in
    // flight re-stamped resources afterwards and the student's refresh skipped
    // every one of them.
    it('queues an explicit refresh behind it and clears the stamps only then', async () => {
      const { gate, release } = blockingSync();
      mockedSync.mockImplementationOnce(async () => {
        await gate;
        // The active run stamps a resource AFTER the refresh was requested.
        markFetched('studyPlan');
      });

      const auto = requestSync('tick');
      const user = requestSync('user');
      release();

      await expect(auto).resolves.toBe(true);
      await expect(user, 'the refresh ran for real').resolves.toBe(true);
      expect(mockedSync).toHaveBeenCalledTimes(2);
      expect(isFresh('studyPlan', TTL.SEMESTER), 'stamps cleared after the active run').toBe(false);
    });
  });

  // Regression: inFlight is only set once run() starts, so while a boot sat
  // queued for a lock another tab held, a second boot saw nothing in flight and
  // queued its own crawl behind it — two full cold-start crawls back to back.
  it('joins a boot still queued for a lock another tab holds', async () => {
    const { releaseHolder } = installQueuingLocks();

    const first = requestSync('boot');
    const second = requestSync('boot');
    releaseHolder();

    await expect(first).resolves.toBe(true);
    await expect(second, 'the second boot joined the queued one').resolves.toBe(false);
    expect(mockedSync).toHaveBeenCalledTimes(1);
  });

  // Regression: an explicit refresh used to await the queued boot's whole lock
  // wait AND its full crawl, then run a second full crawl of its own — the
  // slowest possible way to answer a student who just asked for fresh data.
  // A boot already fetches everything, so joining it is both faster and
  // equivalent.
  it('joins a queued boot on an explicit refresh rather than crawling twice', async () => {
    const { releaseHolder } = installQueuingLocks();

    const boot = requestSync('boot');
    const user = requestSync('user');
    releaseHolder();

    await expect(boot).resolves.toBe(true);
    await expect(user, 'the refresh joined the full crawl already coming').resolves.toBe(false);
    expect(mockedSync).toHaveBeenCalledTimes(1);
  });

  // The other side of that rule: an automatic run only refreshes the hot tier,
  // so it can never stand in for a request for everything.
  it('still runs its own crawl when only a partial automatic run is going', async () => {
    const { gate, release } = blockingSync();
    mockedSync.mockImplementationOnce(async () => {
      await gate;
    });

    const tick = requestSync('tick');
    const user = requestSync('user');
    release();

    await expect(tick).resolves.toBe(true);
    await expect(user).resolves.toBe(true);
    expect(mockedSync).toHaveBeenCalledTimes(2);
  });

  it('drops an automatic run while a boot is queued for the lock', async () => {
    const { releaseHolder } = installQueuingLocks();

    const boot = requestSync('boot');
    await expect(requestSync('tick')).resolves.toBe(false);
    releaseHolder();

    await boot;
    expect(mockedSync).toHaveBeenCalledTimes(1);
  });

  // syncAllData reports its own failures; the gate's job is only to make sure a
  // failing run still counts against the gap, so a broken IS is not retried in
  // a tight loop.
  it('counts a throwing run against the gap instead of retrying immediately', async () => {
    vi.useFakeTimers();
    mockedSync.mockRejectedValueOnce(new Error('IS down'));
    await expect(requestSync('tick')).resolves.toBe(true);
    vi.advanceTimersByTime(MIN_SYNC_GAP - 1);
    await expect(requestSync('tick')).resolves.toBe(false);
    expect(mockedSync).toHaveBeenCalledTimes(1);
  });
});
