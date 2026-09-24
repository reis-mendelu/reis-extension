import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The IS WebView's "open in browser" button, reload button and Android back.
 *
 * Students find IS in the app's WebView harder to use than a real browser, so
 * the WebView offers a way out to one: the button closes the WebView and hands
 * the page the student is ON (not the one the app opened) to the system
 * browser. Only the address leaves — never the session. The student signs in
 * to IS in that browser, because no platform lets an app put cookies into
 * another browser, and a token in a URL would sit in its history and sync.
 */

vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'capacitor' })) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
const setExternalOpening = vi.hoisted(() => vi.fn());
vi.mock('../../store/useAppStore', async () => {
  const { setDemoModeFlag } = await import('../../errors/demoMode');
  return {
    useAppStore: {
      getState: () => ({ setExternalOpening }),
      setState: (patch: { demoMode?: boolean }) => {
        if (patch.demoMode !== undefined) setDemoModeFlag(patch.demoMode);
      },
    },
  };
});

import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';

const TOKEN = 'AbCd12%2Fef34GH%2Bij56==';
const OPENED = 'https://is.mendelu.cz/auth/student/moje_studium.pl';

type Listener = (data: unknown) => void;

/**
 * A plugin whose `remove` really removes. With the no-op `remove` the other
 * suites use, "the listeners are gone" would only mean "remove was called".
 */
const bus = new Map<string, Set<Listener>>();
const listeners = (event: string) => bus.get(event)?.size ?? 0;
const fire = (event: string, data: unknown = {}) => {
  for (const fn of [...(bus.get(event) ?? [])]) fn(data);
};
const addListener = vi.fn(async (event: string, fn: Listener) => {
  if (!bus.has(event)) bus.set(event, new Set());
  bus.get(event)!.add(fn);
  // The page "loads" on the next tick, so openExternal's presentation wait ends.
  if (event === 'browserPageLoaded') setTimeout(() => fn({}), 0);
  return { remove: async () => void bus.get(event)?.delete(fn) };
});
const openWebView = vi.fn(async (_opts: Record<string, unknown>) => ({ id: 'w1' }));
const open = vi.fn(async (_opts: { url: string }) => undefined);
const close = vi.fn(async (_opts?: { id?: string }) => {
  fire('closeEvent', { id: 'w1' });
});
const openUrl = vi.fn(async (_opts: { url: string }) => ({ completed: true }));

const APP_ORIGIN = 'http://localhost:3000/';

beforeEach(() => {
  (window as unknown as { happyDOM?: { setURL?: (url: string) => void } }).happyDOM?.setURL?.(
    APP_ORIGIN
  );
  bus.clear();
  vi.clearAllMocks();
  // The module keeps the live handoff between opens; each test starts clean.
  vi.resetModules();
  vi.mocked(getPlatform).mockReturnValue({
    kind: 'capacitor',
  } as unknown as ReturnType<typeof getPlatform>);
  vi.doMock('@capgo/capacitor-inappbrowser', () => ({
    InAppBrowser: { openWebView, open, close, addListener },
  }));
  vi.doMock('@capacitor/app-launcher', () => ({ AppLauncher: { openUrl } }));
  vi.doMock('../../platform/tokenStore', () => ({ loadStoredToken: vi.fn(async () => TOKEN) }));
});

afterEach(() => {
  vi.doUnmock('../../platform/tokenStore');
});

async function openIs(url = OPENED) {
  const { openExternal } = await import('../openExternal');
  await openExternal(url);
}

/** The button handler is async; let it run to the end. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the IS WebView toolbar', () => {
  it('adds the button, reload and Android back, and keeps the session options as they were', async () => {
    await openIs();

    const opts = openWebView.mock.calls[0]![0];
    expect(opts).toMatchObject({
      url: OPENED,
      isPresentAfterPageLoad: true,
      headers: { Cookie: `UISAuth=${TOKEN}` },
      preShowScriptInjectionTime: 'documentStart',
      showReloadButton: true,
      activeNativeNavigationForWebview: true,
      buttonNearDone: {
        ios: { iconType: 'sf-symbol', icon: 'safari' },
        android: { iconType: 'vector', icon: 'reis_open_in_browser' },
      },
    });
    expect(opts['preShowScript']).toContain(TOKEN);
    // Both platforms REJECT the open — a dead tap on every IS link — when
    // buttonNearDone meets toolbarType activity/navigation/blank or the
    // screenshot button. And the plugin's share button shares the URL the
    // WebView was opened with, not the page the student is on.
    expect(opts).not.toHaveProperty('toolbarType');
    expect(opts).not.toHaveProperty('showScreenshotButton');
    expect(opts).not.toHaveProperty('shareSubject');
  });

  it('leaves a non-IS link on the plain system browser, with nothing listening', async () => {
    await openIs('https://esn.mendelu.cz/event');

    expect(open).toHaveBeenCalledWith({ url: 'https://esn.mendelu.cz/event' });
    expect(openWebView).not.toHaveBeenCalled();
    expect(listeners('buttonNearDoneClick')).toBe(0);
  });

  it('changes nothing off Capacitor', async () => {
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'extension',
    } as unknown as ReturnType<typeof getPlatform>);
    window.open = vi.fn();

    await openIs();

    expect(window.open).toHaveBeenCalledWith(OPENED, '_blank', 'noopener,noreferrer');
    expect(addListener).not.toHaveBeenCalled();
  });

  it('still refuses everything in demo mode', async () => {
    // From the fresh registry: resetModules gives openExternal its own
    // demoMode module, and the flag has to land in that one.
    const { setDemoModeFlag } = await import('../../errors/demoMode');
    setDemoModeFlag(true);
    await expect(openIs()).rejects.toThrow('demo mode');
    setDemoModeFlag(false);

    expect(addListener).not.toHaveBeenCalled();
    expect(openWebView).not.toHaveBeenCalled();
  });
});

describe('open in browser', () => {
  it('opens the page the student is on now, not the one the app opened', async () => {
    await openIs();
    fire('urlChangeEvent', { id: 'w1', url: 'https://is.mendelu.cz/auth/vyveska/' });
    fire('urlChangeEvent', { id: 'w1', url: 'https://is.mendelu.cz/auth/student/terminy.pl' });

    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith({ url: 'https://is.mendelu.cz/auth/student/terminy.pl' });
  });

  it('falls back to the opened page when the WebView never reported a move', async () => {
    await openIs();
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    expect(openUrl).toHaveBeenCalledWith({ url: OPENED });
  });

  it('never puts the session into the launched address', async () => {
    await openIs();
    fire('urlChangeEvent', { id: 'w1', url: 'https://is.mendelu.cz/auth/student/terminy.pl?x=1' });
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    const launched = openUrl.mock.calls[0]![0].url;
    expect(launched).not.toContain(TOKEN);
    expect(launched).not.toContain(decodeURIComponent(TOKEN));
    expect(launched).not.toContain('UISAuth');
  });

  it.each([['javascript:alert(1)'], ['data:text/html,x'], [`${APP_ORIGIN}own-page`]])(
    'refuses to hand %s to the system browser',
    async (url) => {
      await openIs();
      fire('urlChangeEvent', { id: 'w1', url });
      fire('buttonNearDoneClick', { id: 'w1' });
      await settle();

      expect(openUrl).not.toHaveBeenCalled();
      // Nothing to hand over, so the student is not thrown out of the page either.
      expect(close).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith('Mobile.openInBrowser', expect.any(Error));
    }
  );

  it('closes the WebView first, then launches the browser', async () => {
    await openIs();
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    expect(close).toHaveBeenCalledWith({ id: 'w1' });
    expect(close.mock.invocationCallOrder[0]!).toBeLessThan(openUrl.mock.invocationCallOrder[0]!);
  });

  it('still launches the browser if closing the WebView fails', async () => {
    close.mockRejectedValueOnce(new Error('already gone'));
    await openIs();
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    expect(openUrl).toHaveBeenCalledWith({ url: OPENED });
  });

  it('ignores a click from some other WebView', async () => {
    await openIs();
    fire('buttonNearDoneClick', { id: 'someone-else' });
    await settle();

    expect(openUrl).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('the listeners do not outlive the browser', () => {
  const HANDOFF_EVENTS = ['urlChangeEvent', 'buttonNearDoneClick', 'closeEvent'];

  it('removes them when the student closes the WebView', async () => {
    await openIs();
    expect(listeners('buttonNearDoneClick')).toBe(1);

    fire('closeEvent', { id: 'w1' });
    await settle();

    for (const event of HANDOFF_EVENTS) expect(listeners(event)).toBe(0);
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('removes them once the button has been used, so a second tap does nothing', async () => {
    await openIs();
    fire('buttonNearDoneClick', { id: 'w1' });
    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();

    expect(openUrl).toHaveBeenCalledTimes(1);
    for (const event of HANDOFF_EVENTS) expect(listeners(event)).toBe(0);
  });

  it('keeps one set across repeated opens, even if a close was never reported', async () => {
    await openIs();
    await openIs('https://is.mendelu.cz/auth/vyveska/');

    expect(listeners('buttonNearDoneClick')).toBe(1);
    expect(listeners('urlChangeEvent')).toBe(1);

    fire('buttonNearDoneClick', { id: 'w1' });
    await settle();
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith({ url: 'https://is.mendelu.cz/auth/vyveska/' });
  });

  it('removes them when the WebView fails to open at all', async () => {
    openWebView.mockRejectedValueOnce(new Error('plugin exploded'));
    await openIs();
    await settle();

    for (const event of HANDOFF_EVENTS) expect(listeners(event)).toBe(0);
  });
});
