import { logError } from '../utils/reportError';

/**
 * The way out of the in-app IS WebView into a real browser.
 *
 * Students find IS harder to use in the app's WebView than in a real browser:
 * no tabs, no address bar, no history of their own. So the WebView's toolbar
 * gets three things, all capgo options, all phone/tablet only (the extension
 * already runs in a real browser tab, see src/test/guards/openInBrowserIsPhoneOnly):
 *
 * - a button that hands the page the student is ON to the system browser,
 * - a reload button,
 * - Android's back key stepping back through the page history instead of
 *   closing the WebView (iOS has swipe-back already, and the flag defaults on
 *   there).
 *
 * **Only the address leaves.** The session stays in the app. No platform lets an
 * app put cookies into another browser, and a token in the URL would live on in
 * that browser's history, its sync and any server log it reaches. The student
 * signs in to IS once in their browser, and it keeps them signed in from then on.
 *
 * Deliberately NOT capgo's own share button or `shareSubject`: both share the
 * URL the WebView was OPENED with, not the page the student navigated to.
 */
export const BROWSING_TOOLBAR = {
  showReloadButton: true,
  activeNativeNavigationForWebview: true,
  // Only on the default toolbar. Both platforms REJECT the whole open when this
  // meets toolbarType activity/navigation/blank or showScreenshotButton
  // (InAppBrowserPlugin.swift, CapgoInAppBrowserPlugin.java), and a rejected
  // open is a dead tap on every IS link.
  buttonNearDone: {
    ios: { iconType: 'sf-symbol' as const, icon: 'safari' },
    // A drawable in android/app/src/main/res/drawable. The name has to resolve:
    // Android rejects the open, not just the icon, when it does not.
    android: { iconType: 'vector' as const, icon: 'reis_open_in_browser' },
  },
};

type Handle = { remove: () => Promise<void> } | undefined;
type BrowserEvent = { id?: string; url?: string } | undefined;

/** The slice of capgo's InAppBrowser this needs. */
export interface HandoffBrowser {
  addListener(event: string, fn: (data: BrowserEvent) => void): Promise<Handle>;
  close(options?: { id?: string }): Promise<unknown>;
}

export interface Handoff {
  /** The WebView's id once `openWebView` returns it; events from others are ignored after. */
  bind(id: string | undefined): void;
  dispose(): void;
}

/** Hands a URL to the platform: Safari / the default browser, not an in-app view. */
export async function launchInSystemBrowser(url: string): Promise<void> {
  const { AppLauncher } = await import('@capacitor/app-launcher');
  const { completed } = await AppLauncher.openUrl({ url });
  if (!completed) throw new Error('No app accepted the URL');
}

/**
 * One live handoff at a time. A WebView that never reports its close (a failed
 * load, a plugin that dropped the event) would otherwise leave its listeners
 * behind for every later open to multiply.
 */
let current: Handoff | null = null;

/**
 * Listens for the WebView's page changes and its button. Call BEFORE
 * `openWebView`, like the presentation wait: the first page can report itself
 * before that call returns.
 *
 * `validate` is openExternal's own `validateExternalUrl`, passed in so this
 * module does not import back into the one that imports it.
 */
export async function armOpenInBrowser(
  browser: HandoffBrowser,
  openedUrl: string,
  validate: (url: string) => string | null,
  launch: (url: string) => Promise<void> = launchInSystemBrowser
): Promise<Handoff> {
  current?.dispose();

  let page = openedUrl;
  let webViewId: string | undefined;
  let disposed = false;
  let handles: Handle[] = [];
  // Before the id is known every event counts: only one IS WebView is ever up,
  // since the opening scrim blocks a second tap.
  const mine = (data: BrowserEvent) => !webViewId || !data?.id || data.id === webViewId;

  const handoff: Handoff = {
    bind: (id) => {
      webViewId = id;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const handle of handles) void handle?.remove().catch(() => {});
      handles = [];
      if (current === handoff) current = null;
    },
  };
  current = handoff;

  const onClick = async () => {
    const target = validate(page);
    if (!target) {
      // Nothing that may leave the app, so the student keeps the page they are on.
      logError('Mobile.openInBrowser', new Error('Refused to hand a non-external URL over'));
      return;
    }
    handoff.dispose();
    // Closed first: while the WebView is presented, iOS refuses to present
    // anything else over it, and the browser is where the student is going.
    await browser.close(webViewId ? { id: webViewId } : undefined).catch((e: unknown) => {
      logError('Mobile.openInBrowser.close', e);
    });
    await launch(target).catch((e: unknown) => logError('Mobile.openInBrowser', e));
  };

  const listen = (event: string, fn: (data: BrowserEvent) => void) =>
    browser
      .addListener(event, (data) => {
        if (!disposed && mine(data)) fn(data);
      })
      .catch(() => undefined);

  handles = await Promise.all([
    listen('urlChangeEvent', (data) => {
      // iOS reports "" while the WebView is being torn down.
      if (data?.url) page = data.url;
    }),
    listen('buttonNearDoneClick', () => void onClick()),
    listen('closeEvent', () => handoff.dispose()),
  ]);
  // Disposed while subscribing (a second open overtook this one): drop them now.
  if (disposed) for (const handle of handles) void handle?.remove().catch(() => {});

  return handoff;
}
