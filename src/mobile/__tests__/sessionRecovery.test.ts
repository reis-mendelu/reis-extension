import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

const storage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
// The token lives in secureStorage now (#172) — Keystore-encrypted on device,
// never the plaintext Preferences that `storage` is. Both are stubbed so a
// regression that reaches for the wrong one shows up as a failed assertion
// rather than a passing test against the wrong store.
const secureStorage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'capacitor', storage, secureStorage })),
}));
vi.mock('../ensureSession', () => ({ ensureSession: vi.fn() }));
vi.mock('../inAppLoginDeps', () => ({ buildInAppLoginDeps: vi.fn(async () => ({})) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ language: 'cs' }) },
}));
vi.mock('../../injector/syncService', () => ({
  syncAllData: vi.fn(async () => {}),
  get isSyncing() {
    return syncState.busy;
  },
}));

/** Mutable stand-in for syncService's exported `let isSyncing` live binding. */
const syncState = { busy: false };

import { recoverSession, promptSessionRecovery } from '../sessionRecovery';
import { ensureSession } from '../ensureSession';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { syncAllData } from '../../injector/syncService';

const deferred = () => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * Drain any recovery continuation before the next test starts.
 *
 * recoverSession schedules its re-sync behind a poll on syncState.busy, and
 * awaiting recoverSession() does NOT await that continuation -- nor does the
 * toast action in the promptSessionRecovery block, which starts the same chain.
 * Left pending it crosses into a later test and lands inside its timing window
 * as a syncAllData call nobody made, which is how "waits for an in-flight sync"
 * failed under --sequence.shuffle. clearAllMocks cannot help: the call arrives
 * after it. File-level on purpose -- the leak crosses describe boundaries.
 */
afterEach(async () => {
  syncState.busy = false;
  await new Promise((r) => setTimeout(r, 80));
});

describe('recoverSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
      secureStorage,
    } as unknown as ReturnType<typeof getPlatform>);
    vi.mocked(ensureSession).mockResolvedValue('TOKEN-123');
  });

  // ensureSession short-circuits on a plausible stored token. Recovery runs
  // precisely because the stored token is dead, so without clearing it first
  // recovery would hand back the very token that just failed and never show a
  // login at all.
  it('clears the dead token before asking for a new one', async () => {
    await recoverSession();

    expect(secureStorage.remove).toHaveBeenCalledWith('reis.session.uisAuth');
    // And never from plaintext storage: that is where it used to live.
    expect(storage.remove).not.toHaveBeenCalled();

    const clearedAt = secureStorage.remove.mock.invocationCallOrder[0];
    const askedAt = vi.mocked(ensureSession).mock.invocationCallOrder[0];
    expect(clearedAt).toBeDefined();
    expect(askedAt).toBeDefined();
    expect(clearedAt!).toBeLessThan(askedAt!);
  });

  // A sync fans out ~236 requests. If a dozen come back unauthenticated, the
  // student must not get a dozen stacked login WebViews.
  it('opens only one login for concurrent callers', async () => {
    const gate = deferred();
    vi.mocked(ensureSession).mockReturnValue(gate.promise);

    const all = Promise.all([recoverSession(), recoverSession(), recoverSession()]);
    gate.resolve('TOKEN-123');

    expect(await all).toEqual([true, true, true]);
    expect(ensureSession).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh attempt once the previous one has settled', async () => {
    await recoverSession();
    await recoverSession();

    expect(ensureSession).toHaveBeenCalledTimes(2);
  });

  // Dismissing the login is a normal choice, not a crash. Every caller is a
  // catch block that has already given up on its request.
  it('reports false rather than throwing when the student backs out', async () => {
    vi.mocked(ensureSession).mockRejectedValue(new Error('Login cancelled'));

    await expect(recoverSession()).resolves.toBe(false);
    expect(logError).toHaveBeenCalledWith('Mobile.recoverSession', expect.any(Error));
  });

  it('does nothing off Capacitor, where the extension owns re-login', async () => {
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'extension',
      storage,
    } as unknown as ReturnType<typeof getPlatform>);

    await expect(recoverSession()).resolves.toBe(false);
    expect(ensureSession).not.toHaveBeenCalled();
    expect(secureStorage.remove).not.toHaveBeenCalled();
  });
});

describe('promptSessionRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
      secureStorage,
    } as unknown as ReturnType<typeof getPlatform>);
  });

  // The chosen behaviour is prompt-first: a lapsed session must never throw a
  // login WebView over whatever the student is doing.
  it('asks rather than opening a login itself', () => {
    promptSessionRecovery();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(ensureSession).not.toHaveBeenCalled();
  });

  it('offers a sign-in action that starts the recovery', async () => {
    vi.mocked(ensureSession).mockResolvedValue('TOKEN-123');
    promptSessionRecovery();

    const options = vi.mocked(toast.error).mock.calls[0]?.[1] as {
      action?: { onClick: () => void };
    };
    options.action!.onClick();
    // The action fires a promise chain that clears the dead token before it
    // reaches ensureSession, so this needs a turn of the loop, not a tick.
    await vi.waitFor(() => expect(ensureSession).toHaveBeenCalledTimes(1));
  });

  // A fanned-out sync failure raises this from many catch blocks at once; a
  // stable id makes sonner replace rather than stack them.
  it('reuses one toast id so simultaneous failures do not stack', () => {
    promptSessionRecovery();
    promptSessionRecovery();

    const ids = vi.mocked(toast.error).mock.calls.map((c) => (c[1] as { id?: string })?.id);
    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBe(ids[0]);
  });

  it('stays silent off Capacitor', () => {
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'extension',
      storage,
    } as unknown as ReturnType<typeof getPlatform>);

    promptSessionRecovery();

    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('re-sync after recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    syncState.busy = false;
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
      secureStorage,
    } as unknown as ReturnType<typeof getPlatform>);
    vi.mocked(ensureSession).mockResolvedValue('TOKEN-123');
  });

  // Without this the student signs back in and still sees pre-expiry data
  // until the next SYNC_INTERVAL tick.
  it('refreshes the store once the login succeeds', async () => {
    await recoverSession();

    await vi.waitFor(() => expect(syncAllData).toHaveBeenCalledTimes(1));
  });

  // syncAllData opens with `if (isSyncing) return`, and the run that DETECTED
  // the lapse is often still winding down its ~236 requests when the student
  // finishes logging in — so calling straight away drops the re-sync silently.
  it('waits for an in-flight sync instead of being dropped by its guard', async () => {
    syncState.busy = true;
    await recoverSession();

    // Still busy: the re-sync must not have fired yet.
    await new Promise((r) => setTimeout(r, 50));
    expect(syncAllData).not.toHaveBeenCalled();

    syncState.busy = false;
    await vi.waitFor(() => expect(syncAllData).toHaveBeenCalledTimes(1));
  });

  it('does not fail the recovery when the re-sync throws', async () => {
    vi.mocked(syncAllData).mockRejectedValueOnce(new Error('sync blew up'));

    await expect(recoverSession()).resolves.toBe(true);
  });
});

/**
 * Both defects here were found immediately after #185 merged. Neither loses
 * data, but both end with a student who has a perfectly good session being
 * made to log in again.
 */
describe('stale prompts cannot destroy a fresh session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncState.busy = false;
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
      secureStorage,
    } as unknown as ReturnType<typeof getPlatform>);
    vi.mocked(ensureSession).mockResolvedValue('NEW-TOKEN');
  });

  // The toast is duration: Infinity with a stable id, so without an explicit
  // dismiss it simply stays on screen after a SUCCESSFUL re-login — and
  // tapping it again runs recovery, which clears the valid token.
  it('dismisses the prompt once recovery succeeds', async () => {
    promptSessionRecovery('DEAD-TOKEN');
    await recoverSession();

    expect(toast.dismiss).toHaveBeenCalledWith('reis-session-expired');
  });

  it('leaves the prompt up when the student backs out of the login', async () => {
    vi.mocked(ensureSession).mockRejectedValue(new Error('Login cancelled'));

    promptSessionRecovery('DEAD-TOKEN');
    await recoverSession();

    expect(toast.dismiss).not.toHaveBeenCalled();
  });

  // A request issued BEFORE the re-login carries the old token and can land
  // after it. Re-prompting on that would offer to "fix" a session that is
  // already healthy, and accepting would delete the new token.
  it('ignores a failure carrying a token that has already been replaced', async () => {
    await recoverSession();
    vi.mocked(toast.error).mockClear();

    promptSessionRecovery('DEAD-TOKEN');

    expect(toast.error).not.toHaveBeenCalled();
  });

  // A genuine second lapse carries the CURRENT token and must still prompt,
  // otherwise recovery only ever works once per app launch.
  it('still prompts when the current session lapses again', async () => {
    await recoverSession();
    vi.mocked(toast.error).mockClear();

    promptSessionRecovery('NEW-TOKEN');

    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  // Before any recovery has run there is nothing to compare against, so a
  // failure with no token must not be silently swallowed.
  it('prompts for an untagged failure before any recovery has happened', () => {
    promptSessionRecovery();

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
