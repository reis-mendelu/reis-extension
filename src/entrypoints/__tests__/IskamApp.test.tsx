/**
 * IskamApp is the iframe half of the WebISKAM host contract, mirroring what
 * messageHandler does on the IS side. Three things here are contract, not detail:
 *
 *  - ISKAM_READY must go out AFTER the IDB hydration resolves. The content script
 *    flushes its queued sync on that signal; announcing early races the flush
 *    against a store that has not loaded yet.
 *  - `event.source !== window.parent` is the trust boundary. This iframe is
 *    embedded in a page the extension rewrote, and anything can postMessage.
 *  - A sync push must reach IDB as well as the store, or the next cold start
 *    renders empty despite having just received data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const loadFromCache = vi.hoisted(() => vi.fn());
const loadSkmDocuments = vi.hoisted(() => vi.fn());
const receiveSync = vi.hoisted(() => vi.fn());
const initializeIskamStore = vi.hoisted(() => vi.fn());
const sendTelemetry = vi.hoisted(() => vi.fn());
const idbSet = vi.hoisted(() => vi.fn());
const unsub = vi.hoisted(() => vi.fn());

vi.mock('@/store/iskamStore', () => ({
  initializeIskamStore,
  useIskamStore: { getState: () => ({ loadFromCache, loadSkmDocuments, receiveSync }) },
}));
vi.mock('@/services/errorReporter/telemetry', () => ({ sendTelemetry }));
vi.mock('@/services/storage', () => ({ IndexedDBService: { set: idbSet } }));
// The panel and chrome are covered by their own suites; rendering them here just
// drags in the whole component tree.
vi.mock('@/components/IskamPanel/IskamPanel', () => ({ IskamPanel: () => <div /> }));
vi.mock('@/components/Sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('@/components/MobileNav/MobileBottomNav', () => ({ MobileBottomNav: () => <nav /> }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => <div /> }));
vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { IskamApp } from '../iskam/IskamApp';

/** Post a message as if it came from the parent (or not, when `from` differs). */
function post(data: unknown, from: unknown = window.parent) {
  window.dispatchEvent(new MessageEvent('message', { data, source: from as Window }));
}

const syncUpdate = (over: Record<string, unknown> = {}) => ({
  type: 'ISKAM_SYNC_UPDATE',
  data: { iskamData: { konta: [] }, isSyncing: false, error: null, ...over },
});

beforeEach(() => {
  vi.clearAllMocks();
  loadFromCache.mockResolvedValue(undefined);
  loadSkmDocuments.mockResolvedValue(undefined);
  initializeIskamStore.mockResolvedValue(unsub);
  idbSet.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('bootstrap handshake', () => {
  it('announces ISKAM_READY only after the cache has hydrated', async () => {
    let resolveHydration!: () => void;
    loadFromCache.mockReturnValue(
      new Promise<void>((r) => {
        resolveHydration = r;
      })
    );
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    render(<IskamApp />);

    // Hydration still pending: announcing now would race the content script's
    // queue flush against an unloaded store.
    expect(postMessage).not.toHaveBeenCalled();

    resolveHydration();
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ISKAM_READY' }),
        '*'
      )
    );
    postMessage.mockRestore();
  });

  it('loads SKM documents from the iframe context', async () => {
    // Deliberately fetched here rather than in the content script: the iframe is
    // a chrome-extension origin and is not subject to the host page's CORS.
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalledTimes(1));
  });

  it('initialises theme and language', async () => {
    render(<IskamApp />);
    await waitFor(() => expect(initializeIskamStore).toHaveBeenCalledTimes(1));
  });
});

describe('trust boundary', () => {
  it('ignores a sync push that did not come from the parent frame', async () => {
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    post(syncUpdate(), { name: 'not-the-parent' });

    expect(receiveSync).not.toHaveBeenCalled();
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('ignores message types it does not own', async () => {
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    post({ type: 'REIS_SYNC_UPDATE', data: {} }); // the IS host's type, not ours
    post({ type: 'SOMETHING_ELSE' });
    post(null);

    expect(receiveSync).not.toHaveBeenCalled();
    expect(sendTelemetry).not.toHaveBeenCalled();
  });
});

describe('sync push', () => {
  it('persists to IDB and forwards to the store', async () => {
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    const msg = syncUpdate();
    post(msg);

    expect(idbSet).toHaveBeenCalledWith('iskam', 'current', msg.data.iskamData);
    expect(receiveSync).toHaveBeenCalledWith(msg.data.iskamData, false, null);
  });

  it('still forwards a syncing/error push that carries no data', async () => {
    // The spinner and the error banner both ride on this path; skipping it
    // because iskamData is null leaves the UI stuck on stale state.
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    post(syncUpdate({ iskamData: null, isSyncing: true, error: 'expired' }));

    expect(idbSet).not.toHaveBeenCalled();
    expect(receiveSync).toHaveBeenCalledWith(null, true, 'expired');
  });

  it('does not let an IDB write failure break the store update', async () => {
    idbSet.mockRejectedValue(new Error('quota exceeded'));
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    expect(() => post(syncUpdate())).not.toThrow();
    expect(receiveSync).toHaveBeenCalled();
  });
});

describe('telemetry bridge', () => {
  it('reports an error relayed by the content script', async () => {
    // Content scripts have no Supabase access, so they route reports through
    // this frame. Dropping them loses every content-script error.
    render(<IskamApp />);
    await waitFor(() => expect(loadSkmDocuments).toHaveBeenCalled());

    post({ type: 'REIS_TELEMETRY_ERROR', context: 'Iskam.fetchKonta', message: 'boom' });

    expect(sendTelemetry).toHaveBeenCalledWith('Iskam.fetchKonta', expect.any(Error));
    expect(receiveSync).not.toHaveBeenCalled();
  });
});

describe('teardown', () => {
  it('removes the listener and runs the store cleanup on unmount', async () => {
    const { unmount } = render(<IskamApp />);
    await waitFor(() => expect(initializeIskamStore).toHaveBeenCalled());

    unmount();
    post(syncUpdate());

    expect(receiveSync).not.toHaveBeenCalled();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
