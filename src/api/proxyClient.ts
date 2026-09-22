import { Messages } from '../types/messages';
import * as MsgTypes from '../types/messages/base';
import type { DataRequestType } from '../types/messages/base';
import type { ActionType } from '../types/messages';
import { pendingFetches, pendingActions, REQUEST_TIMEOUT } from './proxy/pendingRequests';
import { initProxyListener } from './proxy/messageListener';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import { clearUserParamsCache } from '../utils/userParams';
import { logError } from '../utils/reportError';
import { getPlatform } from '../platform';

export async function fetchViaProxy(
  url: string,
  opts?: MsgTypes.FetchRequestMessage['options']
): Promise<string> {
  initProxyListener();
  const msg = Messages.fetch(url, opts);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingFetches.delete(msg.id);
      reject(new Error(`Timeout: ${url}`));
    }, REQUEST_TIMEOUT);
    pendingFetches.set(msg.id, { resolve, reject, timeout });
    window.parent.postMessage(msg, '*');
  });
}

export async function fetchJsonViaProxy<T>(
  url: string,
  opts?: MsgTypes.FetchRequestMessage['options']
): Promise<T> {
  return JSON.parse(await fetchViaProxy(url, opts));
}

export async function executeAction<T = unknown>(action: ActionType, payload: unknown): Promise<T> {
  initProxyListener();
  const msg = Messages.action(action, payload);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingActions.delete(msg.id);
      reject(new Error(`Timeout: ${action}`));
    }, REQUEST_TIMEOUT);
    pendingActions.set(msg.id, { resolve: resolve as (val: unknown) => void, reject, timeout });
    window.parent.postMessage(msg, '*');
  });
}

export function requestData(t: string) {
  window.parent.postMessage(Messages.requestData(t as DataRequestType), '*');
}
export function openPopup(url: string): Promise<void> {
  return executeAction('open_url', { url });
}

/**
 * Download an IS study document. The content script performs the first-party
 * fetch (SameSite cookie); the returned promise resolves only when the file is
 * actually saved, so callers can show real completion.
 *
 * `fallbackUrl` is the unsealed variant. The retry happens down in the
 * downloader rather than here so the decision can read the real error — across
 * this postMessage boundary a rejection is only a string.
 */
export function downloadDocument(
  url: string,
  filename: string,
  fallbackUrl?: string | null
): Promise<{ usedFallback: boolean }> {
  return executeAction('download_document', {
    url,
    filename,
    fallbackUrl: fallbackUrl ?? undefined,
  });
}

export async function logout(): Promise<void> {
  // The society/admin login first, and on both platforms: it is a SECOND
  // credential, kept by supabase-js in chrome.storage.local rather than in
  // IndexedDB, so every `clearAll()` below went straight past it and the next
  // student to use this browser inherited the previous one's admin console.
  //
  // Awaited, and before the step that ends this context on either platform —
  // the extension's logout navigates the host page away and the app's restart
  // reloads the WebView, so anything merely started here would be killed
  // mid-flight. It never rejects; see clearAdminSession.
  //
  // Imported lazily for the same reason `signOut` below is: this module is in
  // the Capacitor boot path, and a static import constructs the supabase-js
  // admin client at EVALUATION time — which reads chrome.storage through the
  // platform and throws on a WebView that has no `chrome` global at all.
  const { clearAdminSession } = await import('../services/admin/clearAdminSession');
  await clearAdminSession();

  // Mobile takes a different route entirely. The extension's sign-out is
  // DOM-bound in the content script: it finds IS's own logout FORM in the host
  // page and submits it (see injector/messageHandler). The app has no host
  // page, so what signs this device out is removing the stored UISAuth token
  // and the cookie jar that would otherwise restore it — see mobile/signOut.
  if (getPlatform().kind === 'capacitor') {
    const { signOutMobile, buildSignOutDeps } = await import('../mobile/signOut');
    return signOutMobile(buildSignOutDeps());
  }
  clearUserParamsCache();
  try {
    await IndexedDBService.clearAll();
  } catch (e) {
    logError('ProxyClient.logout:clearAll', e);
  }
  return executeAction('logout', {});
}

export function signalReady() {
  window.parent.postMessage(Messages.ready(), '*');
}
export function isInIframe(): boolean {
  try {
    return window.self !== window.parent;
  } catch {
    return true;
  }
}
