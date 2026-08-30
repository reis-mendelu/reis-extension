import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'capacitor' })) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { logError } from '../../utils/reportError';
import { getPlatform } from '../../platform';
import { DemoModeError } from '../../errors/demoMode';
import { useAppStore } from '../../store/useAppStore';

import { externalHrefFromClick, installExternalLinkHandler, openExternal } from '../openExternal';

/** The app's own origin — Capacitor serves from http://localhost on Android,
 *  which is why a bare protocol check is not enough to spot the app's own
 *  pages. Reset before each test so a followed link cannot leak into the next. */
const APP_ORIGIN = 'http://localhost:3000/';
const setAppOrigin = () => {
  (window as unknown as { happyDOM?: { setURL?: (url: string) => void } }).happyDOM?.setURL?.(
    APP_ORIGIN
  );
};

/** Builds an anchor in the document and returns the element clicks target. */
function anchor(attrs: Record<string, string>, childHtml = '<span>x</span>'): HTMLElement {
  const a = document.createElement('a');
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.innerHTML = childHtml;
  document.body.appendChild(a);
  return a.firstElementChild as HTMLElement;
}

const click = (el: Element, init: MouseEventInit = {}) => {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(ev);
  return ev;
};

describe('externalHrefFromClick', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // happy-dom FOLLOWS an un-prevented anchor click, so without this the
    // document's origin drifts to whichever link the previous test clicked —
    // and origin is exactly what the same-origin guard reads.
    setAppOrigin();
  });

  // The point of the whole module. On Capacitor an untouched target="_blank"
  // hands the URL to the SYSTEM BROWSER, which has no IS session — the student
  // lands on a login page instead of their document.
  it('matches an absolute https link opened in a new tab', () => {
    const child = anchor({ href: 'https://is.mendelu.cz/auth/dok_server/', target: '_blank' });
    const ev = click(child);

    expect(externalHrefFromClick(ev)).toBe('https://is.mendelu.cz/auth/dok_server/');
  });

  // Shortcut cards wrap an icon and two spans — the click always lands on a
  // descendant, never the anchor itself.
  it('resolves from a click on a nested child', () => {
    const child = anchor(
      { href: 'https://webiskam.mendelu.cz/', target: '_blank' },
      '<span><svg></svg></span>'
    );
    const ev = click(child.firstElementChild!);

    expect(externalHrefFromClick(ev)).toBe('https://webiskam.mendelu.cz/');
  });

  it('ignores links not opened in a new tab', () => {
    const child = anchor({ href: 'https://is.mendelu.cz/' });
    expect(externalHrefFromClick(click(child))).toBeNull();
  });

  // DocsSheet renders href={sid ? ... : undefined} — the row is present but
  // disabled until the study id resolves. Opening the app's own origin in a
  // browser window would be a bizarre thing to do to a student.
  it('ignores an anchor with no href', () => {
    const child = anchor({ target: '_blank' });
    expect(externalHrefFromClick(click(child))).toBeNull();
  });

  it('ignores an anchor explicitly marked disabled', () => {
    const child = anchor({
      href: 'https://is.mendelu.cz/',
      target: '_blank',
      'aria-disabled': 'true',
    });
    expect(externalHrefFromClick(click(child))).toBeNull();
  });

  // A relative href resolves against the app's own origin (capacitor://
  // localhost), so the protocol guard rejects it without a special case.
  it.each([['mailto:a@b.cz'], ['tel:+420123456789'], ['/auth/local/page']])(
    'ignores the non-http(s) href %s',
    (href) => {
      const child = anchor({ href, target: '_blank' });
      expect(externalHrefFromClick(click(child))).toBeNull();
    }
  );

  it('ignores a click another handler already claimed', () => {
    const child = anchor({ href: 'https://is.mendelu.cz/', target: '_blank' });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    ev.preventDefault();
    child.dispatchEvent(ev);

    expect(externalHrefFromClick(ev)).toBeNull();
  });

  it.each([
    ['middle click', { button: 1 }],
    ['ctrl-click', { ctrlKey: true }],
    ['meta-click', { metaKey: true }],
  ])('leaves %s to the browser', (_name, init) => {
    const child = anchor({ href: 'https://is.mendelu.cz/', target: '_blank' });
    expect(externalHrefFromClick(click(child, init))).toBeNull();
  });
});

describe('installExternalLinkHandler', () => {
  let uninstall: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    // happy-dom FOLLOWS an un-prevented anchor click, so without this the
    // document's origin drifts to whichever link the previous test clicked —
    // and origin is exactly what the same-origin guard reads.
    setAppOrigin();
  });
  afterEach(() => uninstall?.());

  it('cancels the navigation it takes over', () => {
    uninstall = installExternalLinkHandler();
    const child = anchor({ href: 'https://is.mendelu.cz/', target: '_blank' });

    expect(click(child).defaultPrevented).toBe(true);
  });

  it('leaves an in-app navigation alone', () => {
    uninstall = installExternalLinkHandler();
    const child = anchor({ href: 'https://is.mendelu.cz/' });

    expect(click(child).defaultPrevented).toBe(false);
  });

  it('stops intercepting once uninstalled', () => {
    uninstall = installExternalLinkHandler();
    uninstall();
    const child = anchor({ href: 'https://is.mendelu.cz/', target: '_blank' });

    expect(click(child).defaultPrevented).toBe(false);
  });
});

describe('openExternal', () => {
  beforeEach(() => {
    setAppOrigin();
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
    } as unknown as ReturnType<typeof getPlatform>);
    window.open = vi.fn();
  });

  // StudentScreen and NotificationsSheet call openExternal directly, bypassing
  // externalHrefFromClick — and a notification's `link` is data from outside
  // the app. Without validation here a javascript: or app-scheme URL would
  // reach window.open or a native scheme handler untouched.
  it.each([
    ['javascript:alert(1)'],
    ['mailto:a@b.cz'],
    ['not a url at all'],
    ['http://localhost:3000/own-page'],
  ])('refuses to open %s', async (url) => {
    await openExternal(url);

    expect(window.open).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Mobile.openExternal', expect.any(Error));
  });

  // Guards the other network chokepoint: fetchWithAuth carries IS data
  // traffic, openExternal carries the page links. Without this guard a
  // reviewer could tap a link and land on MENDELU's real login in Safari.
  it('refuses to open anything in demo mode', async () => {
    useAppStore.setState({ demoMode: true });
    await expect(openExternal('https://is.mendelu.cz/auth/')).rejects.toBeInstanceOf(DemoModeError);
    useAppStore.setState({ demoMode: false });
  });

  // The non-Capacitor branch: the extension and dev webapp still render the
  // mobile tree at a narrow viewport, so these call sites run there too.
  it('opens a genuine external URL with noopener off Capacitor', async () => {
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'extension',
    } as unknown as ReturnType<typeof getPlatform>);

    await openExternal('https://is.mendelu.cz/auth/dok_server/');

    expect(window.open).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/dok_server/',
      '_blank',
      'noopener,noreferrer'
    );
  });
});

describe('openExternal — which browser', () => {
  const openWebView = vi.fn();
  const open = vi.fn();

  beforeEach(() => {
    setAppOrigin();
    vi.clearAllMocks();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
    } as unknown as ReturnType<typeof getPlatform>);
    vi.doMock('@capgo/capacitor-inappbrowser', () => ({
      InAppBrowser: { openWebView, open },
    }));
  });

  it('keeps IS inside the app, where the session lives, and lets it zoom', async () => {
    // `capacitorTransport` replays UISAuth into the app's own WebView jar and
    // nothing else can see it — sending IS to the system browser would land
    // the student on a login page. The pages are built for a desktop, so the
    // view has to zoom or half of them are unreadable at 390px.
    const { openExternal } = await import('../openExternal');
    await openExternal('https://is.mendelu.cz/auth/student/moje_studium.pl');

    expect(open).not.toHaveBeenCalled();
    expect(openWebView).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://is.mendelu.cz/auth/student/moje_studium.pl',
        enableZoom: true,
      })
    );
  });

  it.each([
    // A mendelu host that is NOT the session host: guards NEEDS_APP_SESSION
    // staying an exact match rather than a mendelu.cz suffix match.
    ['https://webiskam.mendelu.cz/', 'another mendelu host'],
    ['https://esn.mendelu.cz/event', 'a society page'],
    ['https://example.org/whatever', 'a third party'],
  ])('sends %s to the real browser (%s)', async (url) => {
    // Chrome Custom Tabs / SFSafariViewController: the student's own cookies,
    // a visible URL bar and pinch-to-zoom. Nothing here gains from the app's
    // session, so nothing here should be trapped in the app's WebView.
    const { openExternal } = await import('../openExternal');
    await openExternal(url);

    expect(openWebView).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith({ url });
  });
});

describe('openExternal — the in-app browser needs the session on the request', () => {
  const openWebView = vi.fn();
  const open = vi.fn();
  const setCookie = vi.fn();

  beforeEach(() => {
    setAppOrigin();
    vi.clearAllMocks();
    vi.resetModules();
    vi.mocked(getPlatform).mockReturnValue({
      kind: 'capacitor',
    } as unknown as ReturnType<typeof getPlatform>);
    vi.doMock('@capgo/capacitor-inappbrowser', () => ({
      InAppBrowser: { openWebView, open },
    }));
    vi.doMock('@capacitor/core', () => ({ CapacitorCookies: { setCookie } }));
    vi.doMock('../../platform/tokenStore', () => ({
      loadStoredToken: vi.fn(async () => 'TOKEN123'),
    }));
  });

  afterEach(() => {
    vi.doUnmock('@capacitor/core');
    vi.doUnmock('../../platform/tokenStore');
  });

  // The defect this exists for: `buildCookieDelivery` seeds a cookie jar on
  // ANDROID only — on iOS the session travels as a per-request `Cookie` HEADER,
  // which only the native transport sends. The in-app WebView makes its own
  // requests, so it reached IS with no session and the student was asked to
  // sign in again to read their own document.
  it('sends the session as a request header when opening IS', async () => {
    const { openExternal } = await import('../openExternal');
    await openExternal('https://is.mendelu.cz/auth/student/moje_studium.pl');

    expect(openWebView).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://is.mendelu.cz/auth/student/moje_studium.pl',
        headers: { Cookie: 'UISAuth=TOKEN123' },
      })
    );
  });

  // Writing the cookie into a jar was the obvious fix and the wrong one: capgo
  // gives its WebView a separate persistent store on iOS 17+, while
  // CapacitorCookies writes to the host app's — a jar this WebView never reads.
  it('does not write to the host app cookie jar, which this WebView cannot see', async () => {
    const { openExternal } = await import('../openExternal');
    await openExternal('https://is.mendelu.cz/auth/student/moje_studium.pl');

    expect(setCookie).not.toHaveBeenCalled();
  });

  // A third party has no business receiving the student's IS session, and it
  // goes to the system browser, which takes no headers from us at all.
  it('sends no session to a third-party link', async () => {
    const { openExternal } = await import('../openExternal');
    await openExternal('https://example.org/whatever');

    expect(open).toHaveBeenCalledWith({ url: 'https://example.org/whatever' });
    expect(openWebView).not.toHaveBeenCalled();
  });

  // The app's configs block cleartext HTTP today, but that is a platform
  // setting in a different file: an ATS exception or a plugin default changed
  // later must not turn this into the student's session sent in the clear.
  it('never attaches the session over plain http', async () => {
    const { openExternal } = await import('../openExternal');
    await openExternal('http://is.mendelu.cz/auth/student/moje_studium.pl');

    expect(openWebView).toHaveBeenCalledWith(
      expect.not.objectContaining({ headers: expect.anything() })
    );
  });

  // Losing the session must not swallow the tap: with no token the WebView
  // shows IS's login page, which is the correct outcome, not a dead button.
  it('still opens IS when there is no token, with no Cookie header', async () => {
    vi.doMock('../../platform/tokenStore', () => ({
      loadStoredToken: vi.fn(async () => {
        throw new Error('no token');
      }),
    }));
    const { openExternal } = await import('../openExternal');
    await openExternal('https://is.mendelu.cz/auth/student/moje_studium.pl');

    expect(openWebView).toHaveBeenCalledWith(
      expect.not.objectContaining({ headers: expect.anything() })
    );
  });
});

describe('installExternalLinkHandler in demo mode', () => {
  // The click handler used to fire-and-forget with `void`. openExternal
  // rejects with DemoModeError in demo mode, and installErrorReporter's
  // unhandledrejection listener POSTs to Supabase without going through
  // logError — so a blocked tap was reported as a crash. It must reach
  // logError instead, which suppresses the report and shows the toast.
  it('routes the rejection through logError rather than leaving it unhandled', async () => {
    const { installExternalLinkHandler } = await import('../openExternal');
    const { useAppStore } = await import('../../store/useAppStore');
    const reportError = await import('../../utils/reportError');
    const spy = vi.spyOn(reportError, 'logError').mockImplementation(() => {});
    useAppStore.setState({ demoMode: true });

    const remove = installExternalLinkHandler(document);
    const a = document.createElement('a');
    a.href = 'https://example.com/';
    document.body.appendChild(a);

    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);
    a.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', unhandled);
    document.body.removeChild(a);
    remove();
    useAppStore.setState({ demoMode: false });
    spy.mockRestore();
  });
});
