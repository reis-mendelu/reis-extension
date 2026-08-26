/**
 * The content scripts are the half of the host contract that holds the auth
 * cookies. They run at document_start, so the ordering here is load-bearing: the
 * page must be hidden (IS) or blanked (WebISKAM) BEFORE injection starts, or the
 * student sees a flash of the raw IS page every single navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type ContentScript = { matches: string[]; runAt: string; main: () => void };

const startInjection = vi.hoisted(() => vi.fn());
const startBgPokeListener = vi.hoisted(() => vi.fn());
const startIskamInjection = vi.hoisted(() => vi.fn());
const startIskamSync = vi.hoisted(() => vi.fn());
const handleIskamMessage = vi.hoisted(() => vi.fn());

vi.mock('wxt/utils/define-content-script', () => ({
  defineContentScript: (cfg: ContentScript) => cfg,
}));
vi.mock('@/injector/sniper', () => ({ startInjection }));
vi.mock('@/injector/messageHandler', () => ({ handleMessage: vi.fn() }));
vi.mock('@/injector/syncGate', () => ({ stopSyncService: vi.fn() }));
vi.mock('@/injector/bgPokeListener', () => ({ startBgPokeListener }));
vi.mock('@/injector/iskamInjector', () => ({ startIskamInjection }));
vi.mock('@/injector/iskamMessageHandler', () => ({ handleIskamMessage }));
vi.mock('@/injector/iskamSyncService', () => ({ startIskamSync }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  document.documentElement.style.visibility = '';
});

describe('IS Mendelu content script', () => {
  async function load() {
    const mod = await import('../content');
    return mod.default as unknown as ContentScript;
  }

  it('only claims the authenticated IS entry URLs', async () => {
    const cs = await load();
    expect(cs.matches.every((m) => m.startsWith('https://is.mendelu.cz/auth/'))).toBe(true);
  });

  it('runs at document_start so nothing paints first', async () => {
    const cs = await load();
    expect(cs.runAt).toBe('document_start');
  });

  it('hides the page and starts injection and the poke listener', async () => {
    const cs = await load();

    cs.main();

    expect(document.documentElement.style.visibility).toBe('hidden');
    expect(startInjection).toHaveBeenCalledTimes(1);
    expect(startBgPokeListener).toHaveBeenCalledTimes(1);
  });
});

describe('WebISKAM content script', () => {
  async function load(enabled: boolean) {
    vi.doMock('@/config/featureFlags', () => ({ ISKAM_ENABLED: enabled }));
    const mod = await import('../webiskam.content');
    return mod.default as unknown as ContentScript;
  }

  it('only claims the ObjednavkyStravovani pages', async () => {
    const cs = await load(true);
    expect(
      cs.matches.every((m) => m.startsWith('https://webiskam.mendelu.cz/ObjednavkyStravovani'))
    ).toBe(true);
  });

  it('blanks the document and wires injection, messages and sync when enabled', async () => {
    const cs = await load(true);

    cs.main();

    expect(startIskamInjection).toHaveBeenCalledTimes(1);
    expect(startIskamSync).toHaveBeenCalledTimes(1);
  });

  it('registers the ISKAM message handler, not the IS one', async () => {
    // The two factories are deliberately separate; crossing them would let IS
    // messages drive the ISKAM store.
    const cs = await load(true);
    const addListener = vi.spyOn(window, 'addEventListener');

    cs.main();

    expect(addListener).toHaveBeenCalledWith('message', handleIskamMessage);
    addListener.mockRestore();
  });

  it('does NOTHING when the feature flag is off', async () => {
    // The flag has to gate the side effects, not just the UI: this script
    // rewrites the host document, which is not undoable.
    const cs = await load(false);
    const addListener = vi.spyOn(window, 'addEventListener');

    cs.main();

    expect(startIskamInjection).not.toHaveBeenCalled();
    expect(startIskamSync).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalledWith('message', handleIskamMessage);
    addListener.mockRestore();
  });
});
