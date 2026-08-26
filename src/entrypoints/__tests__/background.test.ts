/**
 * The service worker is the extension's only network proxy and its only route to
 * chrome.identity. Everything here is a contract with callers that cannot see
 * inside it: return `true` or the message channel closes before sendResponse
 * lands, and the caller hangs forever with no error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// defineBackground just brands the callback for WXT's build; unwrap it so the
// real registration body can be invoked directly.
vi.mock('wxt/utils/define-background', () => ({
  defineBackground: (fn: () => void) => fn,
}));

type Listener = (msg: unknown, sender: unknown, respond: (r: unknown) => void) => boolean;

let messageListeners: Listener[];
let installedListeners: Array<() => void>;
let alarmListeners: Array<(a: { name: string }) => void>;
let chromeMock: Record<string, unknown>;

/** Offer a message to every registered listener; return the one that claimed it. */
function dispatch(msg: unknown) {
  const respond = vi.fn();
  const returns = messageListeners.map((l) => l(msg, {}, respond));
  return { respond, keptOpen: returns.some((r) => r === true) };
}

beforeEach(async () => {
  vi.resetModules();
  messageListeners = [];
  installedListeners = [];
  alarmListeners = [];

  chromeMock = {
    runtime: {
      onMessage: { addListener: (l: Listener) => messageListeners.push(l) },
      onInstalled: { addListener: (l: () => void) => installedListeners.push(l) },
    },
    identity: {
      getRedirectURL: vi.fn(() => 'https://abc.chromiumapp.org/'),
      launchWebAuthFlow: vi.fn(),
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: (l: (a: { name: string }) => void) => alarmListeners.push(l) },
    },
    tabs: { query: vi.fn(), sendMessage: vi.fn(() => Promise.resolve()) },
  };
  vi.stubGlobal('chrome', chromeMock);

  const mod = await import('../background');
  (mod.default as unknown as () => void)();
});

describe('REIS_BG_FETCH proxy', () => {
  it('keeps the message channel open so the async response can land', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => '<html/>' }))
    );

    const { respond, keptOpen } = dispatch({ type: 'REIS_BG_FETCH', url: 'https://is/x' });

    expect(keptOpen).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({ success: true, data: '<html/>' });
  });

  it('ignores messages of other types without responding', () => {
    const { respond, keptOpen } = dispatch({ type: 'SOMETHING_ELSE' });
    expect(keptOpen).toBe(false);
    expect(respond).not.toHaveBeenCalled();
  });

  it('reports a non-2xx as a failure instead of returning the error body', async () => {
    // A 302 to the login page returns a perfectly parseable HTML body. Passing it
    // through as success is how an expired session becomes "no data" downstream.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => 'login' }))
    );

    const { respond } = dispatch({ type: 'REIS_BG_FETCH', url: 'https://is/x' });

    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('401'),
    });
  });

  it('reports a network rejection as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );

    const { respond } = dispatch({ type: 'REIS_BG_FETCH', url: 'https://is/x' });

    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('offline'),
    });
  });

  it('forwards only the request options that were actually supplied', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', fetchMock);

    dispatch({
      type: 'REIS_BG_FETCH',
      url: 'https://is/x',
      options: { method: 'POST', body: 'a=1' },
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // No `headers` key at all rather than `headers: undefined` -- the latter is
    // not the same request once it reaches fetch.
    expect(fetchMock).toHaveBeenCalledWith('https://is/x', { method: 'POST', body: 'a=1' });
  });
});

describe('Google OAuth bridge', () => {
  it('answers the redirect URL synchronously', () => {
    const { respond, keptOpen } = dispatch({ type: 'GOOGLE_GET_REDIRECT_URL' });

    expect(respond).toHaveBeenCalledWith({
      success: true,
      url: 'https://abc.chromiumapp.org/',
    });
    // Answered inline, so the channel must NOT be held open.
    expect(keptOpen).toBe(false);
  });

  it('reports a failure when chrome.identity throws', () => {
    (chromeMock.identity as { getRedirectURL: () => string }).getRedirectURL = () => {
      throw new Error('no identity');
    };

    const { respond } = dispatch({ type: 'GOOGLE_GET_REDIRECT_URL' });

    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('no identity'),
    });
  });

  it('degrades with a clear message where launchWebAuthFlow is unavailable', () => {
    // Firefox/Edge builds ship without it; the caller must get an explanation
    // rather than a hang.
    (chromeMock.identity as Record<string, unknown>).launchWebAuthFlow = undefined;

    const { respond, keptOpen } = dispatch({
      type: 'GOOGLE_LAUNCH_WEB_AUTH_FLOW',
      url: 'https://accounts.google.com/o/oauth2/auth',
    });

    expect(keptOpen).toBe(false);
    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('unavailable'),
    });
  });

  it('returns the redirect on a completed auth flow', async () => {
    (chromeMock.identity as { launchWebAuthFlow: unknown }).launchWebAuthFlow = vi.fn(
      async () => 'https://abc.chromiumapp.org/#access_token=t'
    );

    const { respond, keptOpen } = dispatch({
      type: 'GOOGLE_LAUNCH_WEB_AUTH_FLOW',
      url: 'https://accounts.google.com/o/oauth2/auth',
    });

    expect(keptOpen).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({
      success: true,
      redirect: 'https://abc.chromiumapp.org/#access_token=t',
    });
  });

  it('reports a cancelled auth flow as a failure', async () => {
    (chromeMock.identity as { launchWebAuthFlow: unknown }).launchWebAuthFlow = vi.fn(async () => {
      throw new Error('The user did not approve access.');
    });

    const { respond } = dispatch({ type: 'GOOGLE_LAUNCH_WEB_AUTH_FLOW', url: 'https://x' });

    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('did not approve'),
    });
  });
});

describe('re-sync poke alarm', () => {
  it('registers the periodic alarm on install', () => {
    installedListeners.forEach((l) => l());
    expect((chromeMock.alarms as { create: unknown }).create).toHaveBeenCalledWith('reis-bg-poke', {
      periodInMinutes: 15,
    });
  });

  it('pokes every open IS tab when the alarm fires', () => {
    const tabs = chromeMock.tabs as {
      query: ReturnType<typeof vi.fn>;
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.query.mockImplementation((_q: unknown, cb: (t: unknown[]) => void) =>
      cb([{ id: 1 }, { id: 2 }])
    );

    alarmListeners.forEach((l) => l({ name: 'reis-bg-poke' }));

    expect(tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'REIS_BG_POKE' });
    expect(tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'REIS_BG_POKE' });
  });

  it('ignores alarms belonging to anything else', () => {
    const tabs = chromeMock.tabs as { query: ReturnType<typeof vi.fn> };
    alarmListeners.forEach((l) => l({ name: 'some-other-alarm' }));
    expect(tabs.query).not.toHaveBeenCalled();
  });

  it('skips tabs with no id and survives a send that rejects', () => {
    // A discarded tab has no id, and a tab without the content script rejects.
    // Either one throwing here would stop the loop and starve the later tabs.
    const tabs = chromeMock.tabs as {
      query: ReturnType<typeof vi.fn>;
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.query.mockImplementation((_q: unknown, cb: (t: unknown[]) => void) =>
      cb([{ id: undefined }, { id: 7 }])
    );
    tabs.sendMessage.mockReturnValue(Promise.reject(new Error('no receiver')));

    expect(() => alarmListeners.forEach((l) => l({ name: 'reis-bg-poke' }))).not.toThrow();
    expect(tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'REIS_BG_POKE' });
  });
});
