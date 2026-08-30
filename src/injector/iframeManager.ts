import { IFRAME_ID } from './config';
import { getPlatform } from '../platform';

export let iframeElement: HTMLIFrameElement | null = null;
let iframeReady = false;
let messageQueue: unknown[] = [];

export function injectIframe() {
  document.body.replaceChildren();
  document.head.replaceChildren();

  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = chrome.runtime.getURL('reIS_logo.svg');
  document.head.appendChild(favicon);

  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  document.head.appendChild(viewport);

  iframeElement = document.createElement('iframe');
  iframeElement.id = IFRAME_ID;
  iframeElement.src = chrome.runtime.getURL('main.html');

  Object.assign(iframeElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    border: 'none',
    margin: '0',
    padding: '0',
    overflow: 'hidden',
    zIndex: '2147483647',
    backgroundColor: '#f8fafc',
  });

  iframeElement.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads'
  );
  iframeElement.setAttribute('allow', 'clipboard-write');

  document.body.appendChild(iframeElement);
  document.body.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
  document.documentElement.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
  document.documentElement.style.visibility = 'visible';
}

/**
 * Mark the iframe as ready and flush any queued messages.
 * Called when the iframe sends REIS_READY.
 */
/**
 * The extension's own origin. Every message on this channel carries the
 * student's IS dataset — grades, schedule, exams, classmates, documents — so it
 * is pinned rather than broadcast. With `'*'`, any script on the host page that
 * could retarget the iframe's `src` would receive all of it.
 */
const IFRAME_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');

export function markIframeReady() {
  iframeReady = true;
  if (messageQueue.length > 0 && iframeElement?.contentWindow) {
    for (const msg of messageQueue) {
      iframeElement.contentWindow.postMessage(msg, IFRAME_ORIGIN);
    }
  }
  messageQueue = [];
}

export function sendToIframe(message: unknown) {
  // Capacitor has no content script and no iframe — the app IS the receiver.
  // Post to our own window so useAppLogic's existing REIS_SYNC_UPDATE handler
  // picks it up unchanged: at top level `window.parent === window`, which is
  // exactly the check that handler makes. This keeps ONE sync implementation
  // instead of forking syncService per host.
  if (getPlatform().kind === 'capacitor') {
    // Deliberately '*' here, unlike the iframe path below. This posts to our
    // OWN window — the message never crosses a document boundary, so there is
    // no other origin that could receive it. Pinning it would add no security
    // and would silently break mobile sync on any Capacitor scheme whose
    // `location.origin` does not round-trip (e.g. "null"), which is a real risk
    // for zero benefit. The leak the audit found was the cross-document post
    // below, and that is what is pinned.
    window.postMessage(message, '*');
    return;
  }
  if (!iframeElement?.contentWindow) return;
  if (!iframeReady) {
    messageQueue.push(message);
    return;
  }
  iframeElement.contentWindow.postMessage(message, IFRAME_ORIGIN);
}
