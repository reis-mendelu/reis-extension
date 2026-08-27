/**
 * The queue-and-flush half of the host contract, and the module that actually
 * posts into the iframe.
 *
 * The ordering it enforces is the whole reason REIS_READY exists: the content
 * script starts syncing before the iframe app has mounted, so anything sent in
 * that window would be posted at a contentWindow with no listener yet and
 * vanish. Queue-until-ready is what makes the first paint show real data instead
 * of an empty skeleton that only fills on the next sync tick.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getPlatform = vi.hoisted(() => vi.fn(() => ({ kind: 'extension' })));
vi.mock('../../platform', () => ({ getPlatform }));

type Manager = typeof import('../iframeManager');

/** Fresh module state per test — iframeReady and the queue are module-scoped. */
async function load(): Promise<Manager> {
  vi.resetModules();
  return import('../iframeManager');
}

const postMessage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getPlatform.mockReturnValue({ kind: 'extension' });
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  vi.stubGlobal('chrome', { runtime: { getURL: (p: string) => `chrome-extension://abc/${p}` } });
});

/** Inject, then hand the iframe a stub contentWindow we can observe. */
async function injected() {
  const m = await load();
  m.injectIframe();
  Object.defineProperty(m.iframeElement!, 'contentWindow', {
    configurable: true,
    value: { postMessage },
  });
  return m;
}

describe('injectIframe', () => {
  it('replaces the host page rather than embedding beside it', async () => {
    document.body.innerHTML = '<div id="is-content">IS page</div>';

    const m = await load();
    m.injectIframe();

    expect(document.getElementById('is-content')).toBeNull();
    expect(m.iframeElement).not.toBeNull();
  });

  it('sandboxes the iframe without allow-top-navigation or allow-forms', async () => {
    // The frame is injected into a page the student is authenticated on. These
    // tokens are the ones that would let it navigate the top window away or
    // post a form as the student.
    const m = await load();
    m.injectIframe();

    const sandbox = m.iframeElement!.getAttribute('sandbox') ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(sandbox).not.toContain('allow-forms');
    expect(sandbox).not.toContain('allow-modals');
  });

  it('loads the extension page, never a remote URL', async () => {
    const m = await load();
    m.injectIframe();

    expect(m.iframeElement!.src).toBe('chrome-extension://abc/main.html');
  });

  it('reveals the document it had hidden at document_start', async () => {
    // content.ts hides documentElement before injection to stop the raw IS page
    // flashing. If injection never un-hides it the student sees nothing at all.
    document.documentElement.style.visibility = 'hidden';

    const m = await load();
    m.injectIframe();

    expect(document.documentElement.style.visibility).toBe('visible');
  });
});

describe('queue until ready', () => {
  it('does NOT post before the iframe signals ready', async () => {
    const m = await injected();

    m.sendToIframe({ type: 'REIS_SYNC_UPDATE', n: 1 });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('flushes everything queued, in order, on ready', async () => {
    const m = await injected();
    m.sendToIframe({ n: 1 });
    m.sendToIframe({ n: 2 });

    m.markIframeReady();

    expect(postMessage.mock.calls.map((c) => c[0])).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('posts straight through once ready', async () => {
    const m = await injected();
    m.markIframeReady();

    m.sendToIframe({ n: 3 });

    expect(postMessage).toHaveBeenCalledWith({ n: 3 }, '*');
  });

  it('does not re-send the queue on a second ready signal', async () => {
    // REIS_READY arrives again whenever the iframe reloads. Replaying a stale
    // queue would re-apply sync payloads the app has already consumed.
    const m = await injected();
    m.sendToIframe({ n: 1 });
    m.markIframeReady();
    postMessage.mockClear();

    m.markIframeReady();

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('drops messages when there is no iframe at all', async () => {
    // Injection failed or the page tore it out; sending must not throw and take
    // the sync run down with it.
    const m = await load();

    expect(() => m.sendToIframe({ n: 1 })).not.toThrow();
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('capacitor', () => {
  it('posts to its own window, bypassing the queue entirely', async () => {
    // There is no content script and no iframe on the phone — the app IS the
    // receiver, and at top level window.parent === window, which is the check
    // useAppLogic's handler already makes. One sync implementation, not two.
    getPlatform.mockReturnValue({ kind: 'capacitor' });
    const own = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const m = await load();

    m.sendToIframe({ n: 9 });

    expect(own).toHaveBeenCalledWith({ n: 9 }, '*');
    own.mockRestore();
  });
});
