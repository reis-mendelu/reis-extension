/**
 * The ISKAM sync run. Per CLAUDE.md an expired WebISKAM session is NOT reported
 * to the iframe as an error — it redirects to /ObjednavkyStravovani so Shibboleth
 * can re-authenticate. That distinction is the whole behaviour here: treat a
 * lapsed session like a network failure and the student sits looking at an error
 * banner on a page that would have fixed itself by reloading.
 *
 * The optimistic first update matters too. It carries the CACHED data with
 * isSyncing=true, so the panel keeps showing last-known balances while the
 * refresh runs instead of blanking to a skeleton on every sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendToIskamIframe = vi.hoisted(() => vi.fn());
const fetchDualLanguageIskam = vi.hoisted(() => vi.fn());

vi.mock('../iskamInjector', () => ({ sendToIskamIframe }));
vi.mock('../../api/iskam', () => ({ fetchDualLanguageIskam }));

const realLocation = window.location;

/**
 * Fresh module state — cachedIskamData and the syncing flag are module-scoped.
 *
 * The error class comes from the SAME graph as the service. `vi.resetModules()`
 * rebuilds the graph, so a class imported at the top of this file is a different
 * object than the one the service checks `instanceof` against, and the auth
 * branch would never be taken.
 */
async function load() {
  vi.resetModules();
  const [service, errors] = await Promise.all([
    import('../iskamSyncService'),
    import('../../api/iskam/errors'),
  ]);
  return { ...service, IskamAuthError: errors.IskamAuthError };
}

/** Capture navigation instead of performing it. */
function captureNavigation() {
  const to = { href: '' };
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...realLocation,
      get href() {
        return '';
      },
      set href(v: string) {
        to.href = v;
      },
    },
  });
  return to;
}

const updates = () =>
  sendToIskamIframe.mock.calls
    .map(
      (c) =>
        c[0] as { type: string; data?: { iskamData: unknown; isSyncing: boolean; error: unknown } }
    )
    .filter((m) => m.type === 'ISKAM_SYNC_UPDATE');

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  fetchDualLanguageIskam.mockResolvedValue({ konta: [{ name: 'Hlavní konto' }] });
});

describe('successful sync', () => {
  it('announces syncing first, then delivers the data', async () => {
    const s = await load();

    await s.syncIskamData();

    const [first, second] = updates();
    expect(first!.data!.isSyncing).toBe(true);
    expect(second!.data!.isSyncing).toBe(false);
    expect(second!.data!.iskamData).toEqual({ konta: [{ name: 'Hlavní konto' }] });
  });

  it('keeps showing the cached data while refreshing', async () => {
    // The optimistic update carries the PREVIOUS payload, so the panel does not
    // blank to a skeleton on every sync.
    const s = await load();
    await s.syncIskamData();
    sendToIskamIframe.mockClear();

    await s.syncIskamData();

    expect(updates()[0]!.data!.iskamData).toEqual({ konta: [{ name: 'Hlavní konto' }] });
  });
});

describe('expired session', () => {
  it('REDIRECTS to re-authenticate rather than reporting an error', async () => {
    const nav = captureNavigation();
    const s = await load();
    fetchDualLanguageIskam.mockRejectedValue(new s.IskamAuthError());

    await s.syncIskamData();

    expect(nav.href).toContain('/ObjednavkyStravovani');
    // No error update: an error banner on a page that fixes itself by reloading
    // is worse than the reload.
    expect(updates().some((u) => u.data!.error !== null)).toBe(false);
  });

  it('releases the re-entrancy flag so a later sync can still run', async () => {
    // The redirect returns early, before the update the happy path sends. If the
    // flag leaked, the sync after re-authentication would be dropped silently.
    const nav = captureNavigation();
    const s = await load();
    fetchDualLanguageIskam.mockRejectedValue(new s.IskamAuthError());
    await s.syncIskamData();
    expect(nav.href).toContain('/ObjednavkyStravovani');

    fetchDualLanguageIskam.mockResolvedValue({ konta: [] });
    sendToIskamIframe.mockClear();
    await s.syncIskamData();

    expect(updates().length).toBeGreaterThan(0);
  });
});

describe('network failure', () => {
  it('reports a network error AND sends telemetry', async () => {
    fetchDualLanguageIskam.mockRejectedValue(new Error('offline'));
    const s = await load();

    await s.syncIskamData();

    const last = updates().at(-1)!;
    expect(last.data!.error).toBe('network');
    expect(last.data!.isSyncing).toBe(false);
    expect(
      sendToIskamIframe.mock.calls.some(
        (c) => (c[0] as { type: string }).type === 'REIS_TELEMETRY_ERROR'
      )
    ).toBe(true);
  });

  it('keeps the last good data on screen after a failure', async () => {
    // Losing the balances because one refresh failed is a worse outcome than
    // showing slightly stale ones.
    const s = await load();
    await s.syncIskamData();
    fetchDualLanguageIskam.mockRejectedValue(new Error('offline'));
    sendToIskamIframe.mockClear();

    await s.syncIskamData();

    expect(updates().at(-1)!.data!.iskamData).toEqual({ konta: [{ name: 'Hlavní konto' }] });
  });
});

describe('re-entrancy', () => {
  it('ignores a second run while one is in flight', async () => {
    // Two crawls of WebISKAM at once doubles the load for no benefit and can
    // interleave their updates.
    let release!: () => void;
    fetchDualLanguageIskam.mockReturnValue(
      new Promise((r) => {
        release = () => r({ konta: [] });
      })
    );
    const s = await load();

    const first = s.syncIskamData();
    await s.syncIskamData(); // must be a no-op

    expect(fetchDualLanguageIskam).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});
