import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

const storage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'capacitor', storage })),
}));
vi.mock('../ensureSession', () => ({ ensureSession: vi.fn() }));
vi.mock('../inAppLoginDeps', () => ({ buildInAppLoginDeps: vi.fn(async () => ({})) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ language: 'cs' }) },
}));

import { recoverSession, promptSessionRecovery } from '../sessionRecovery';
import { ensureSession } from '../ensureSession';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';

const deferred = () => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('recoverSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
    } as unknown as ReturnType<typeof getPlatform>);
    vi.mocked(ensureSession).mockResolvedValue('TOKEN-123');
  });

  // ensureSession short-circuits on a plausible stored token. Recovery runs
  // precisely because the stored token is dead, so without clearing it first
  // recovery would hand back the very token that just failed and never show a
  // login at all.
  it('clears the dead token before asking for a new one', async () => {
    await recoverSession();

    expect(storage.remove).toHaveBeenCalledWith('reis.session.uisAuth');
    expect(storage.remove.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(ensureSession).mock.invocationCallOrder[0]
    );
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
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('promptSessionRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
      storage,
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
