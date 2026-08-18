import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSync, __resetSyncGateForTests } from '../syncGate';
import { MIN_SYNC_GAP, SYNC_LOCK_WAIT_MS } from '../config';
import { syncAllData } from '../syncService';
import { isFresh, markFetched, TTL } from '../syncTtl';

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
