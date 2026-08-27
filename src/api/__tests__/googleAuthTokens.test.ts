/**
 * Token lifecycle for the Drive connection. All of it was untested.
 *
 * The consequential case is `invalid_grant`. A revoked or expired refresh token
 * can never recover by retrying — only re-consent fixes it. If the stored tokens
 * are not cleared, isConnected() keeps returning true, the UI keeps saying
 * "connected", and every backup fails silently forever. Clearing them is what
 * turns a permanent silent failure into a visible "connect again".
 *
 * The stampede guard matters for a different reason: Drive uploads run at
 * pLimit(3), so an expired token means three simultaneous refreshes of the same
 * credential, and Google may invalidate the losers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};

const fetchMock = vi.fn();

/** A stored credential, expired or not. */
const tokens = (over: Record<string, unknown> = {}) => ({
  access_token: 'AT-old',
  refresh_token: 'RT',
  expiry: Date.now() + 60 * 60 * 1000,
  email: 'student@mendelu.cz',
  ...over,
});

/** Fresh module state — refreshInFlight is module-scoped. */
async function load() {
  vi.resetModules();
  return import('../googleAuth');
}

function proxyReturns(body: Record<string, unknown>, ok = true, status = 200) {
  fetchMock.mockResolvedValue({
    ok,
    status,
    statusText: 'err',
    json: async () => body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', { storage: { local: storage }, runtime: { id: 'abc' } });
  vi.stubGlobal('fetch', fetchMock);
  storage.get.mockResolvedValue({ reis_google_tokens: tokens() });
  storage.set.mockResolvedValue(undefined);
  storage.remove.mockResolvedValue(undefined);
  proxyReturns({ access_token: 'AT-new', expires_in: 3600 });
});

describe('getAccessToken', () => {
  it('returns the stored token without calling the proxy when it is still valid', async () => {
    const a = await load();

    await expect(a.getAccessToken()).resolves.toBe('AT-old');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes once the token is inside the expiry buffer', async () => {
    // Refreshed 60s BEFORE the real expiry: a token that expires mid-upload
    // fails the upload, and the buffer is what prevents that.
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() + 30_000 }) });
    const a = await load();

    await expect(a.getAccessToken()).resolves.toBe('AT-new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes an already-expired token', async () => {
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    const a = await load();

    await expect(a.getAccessToken()).resolves.toBe('AT-new');
  });

  it('persists the refreshed token with a new expiry', async () => {
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    const a = await load();

    await a.getAccessToken();

    const saved = storage.set.mock.calls[0]![0].reis_google_tokens;
    expect(saved.access_token).toBe('AT-new');
    expect(saved.expiry).toBeGreaterThan(Date.now());
    // The refresh token is NOT reissued by this flow and must survive.
    expect(saved.refresh_token).toBe('RT');
  });

  it('refuses when there is no stored connection', async () => {
    storage.get.mockResolvedValue({});
    const a = await load();

    await expect(a.getAccessToken()).rejects.toThrow('Not connected');
  });

  it('collapses concurrent refreshes into ONE proxy call', async () => {
    // Drive uploads run at pLimit(3). Three simultaneous refreshes of the same
    // credential can have Google invalidate the losers.
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    const a = await load();

    const [x, y, z] = await Promise.all([
      a.getAccessToken(),
      a.getAccessToken(),
      a.getAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([x, y, z]).toEqual(['AT-new', 'AT-new', 'AT-new']);
  });

  it('allows a later refresh after the in-flight one settles', async () => {
    // The guard must be released in `finally`, or the FIRST refresh of a session
    // would be the only one that ever happens.
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    const a = await load();
    await a.getAccessToken();

    proxyReturns({ access_token: 'AT-third', expires_in: 3600 });
    await expect(a.getAccessToken()).resolves.toBe('AT-third');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('invalid_grant', () => {
  it('DISCONNECTS, so the UI stops claiming the account is connected', async () => {
    // Without this the student sees "connected" while every backup silently
    // fails, with no way to discover why.
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    proxyReturns({ error: 'invalid_grant' }, false, 400);
    const a = await load();

    await expect(a.getAccessToken()).rejects.toThrow(/invalid_grant/i);
    expect(storage.remove).toHaveBeenCalledWith('reis_google_tokens');
  });

  it('does NOT disconnect on an ordinary network failure', async () => {
    // A transient proxy outage must not force the student through re-consent.
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    fetchMock.mockRejectedValue(new Error('network down'));
    const a = await load();

    await expect(a.getAccessToken()).rejects.toThrow('network down');
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('does not disconnect on a 500 from the proxy', async () => {
    storage.get.mockResolvedValue({ reis_google_tokens: tokens({ expiry: Date.now() - 1000 }) });
    proxyReturns({ error: 'upstream unavailable' }, false, 500);
    const a = await load();

    await expect(a.getAccessToken()).rejects.toThrow();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('connection state', () => {
  it('reports connected only when a credential is stored', async () => {
    const a = await load();
    await expect(a.isConnected()).resolves.toBe(true);

    storage.get.mockResolvedValue({});
    await expect(a.isConnected()).resolves.toBe(false);
  });

  it('exposes the account email so the UI can say WHERE files go', async () => {
    const a = await load();
    await expect(a.getConnectedEmail()).resolves.toBe('student@mendelu.cz');
  });

  it('returns a null email rather than throwing when disconnected', async () => {
    storage.get.mockResolvedValue({});
    const a = await load();
    await expect(a.getConnectedEmail()).resolves.toBeNull();
  });

  it('fails soft when the extension context has been torn down', async () => {
    // chrome.storage disappears when the extension reloads under a page that
    // did not. Throwing here would surface as a crash in an unrelated feature.
    vi.stubGlobal('chrome', undefined);
    const a = await load();

    await expect(a.isConnected()).resolves.toBe(false);
    await expect(a.getConnectedEmail()).resolves.toBeNull();
  });
});
