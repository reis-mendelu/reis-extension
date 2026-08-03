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

export async function fetchViaProxy(url: string, opts?: MsgTypes.FetchRequestMessage['options']): Promise<string> {
    initProxyListener();
    const msg = Messages.fetch(url, opts);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { pendingFetches.delete(msg.id); reject(new Error(`Timeout: ${url}`)); }, REQUEST_TIMEOUT);
        pendingFetches.set(msg.id, { resolve, reject, timeout });
        window.parent.postMessage(msg, '*');
    });
}

export async function fetchJsonViaProxy<T>(url: string, opts?: MsgTypes.FetchRequestMessage['options']): Promise<T> {
    return JSON.parse(await fetchViaProxy(url, opts));
}

export async function executeAction<T = unknown>(action: ActionType, payload: unknown): Promise<T> {
    initProxyListener();
    const msg = Messages.action(action, payload);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { pendingActions.delete(msg.id); reject(new Error(`Timeout: ${action}`)); }, REQUEST_TIMEOUT);
        pendingActions.set(msg.id, { resolve: resolve as (val: unknown) => void, reject, timeout });
        window.parent.postMessage(msg, '*');
    });
}

export function requestData(t: string) { window.parent.postMessage(Messages.requestData(t as DataRequestType), '*'); }
export function openPopup(url: string): Promise<void> { return executeAction('open_url', { url }); }

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
  return executeAction('download_document', { url, filename, fallbackUrl: fallbackUrl ?? undefined });
}

export async function logout(): Promise<void> {
    // Mobile has no logout responder yet: a real sign-out POSTs
    // /auth/system/logout.pl and the Capacitor transport is GET-only until the
    // POST work lands. Bail BEFORE clearing anything — the destructive half
    // must not run when the sign-out itself cannot, or the student is left with
    // an emptied app AND a live session.
    if (getPlatform().kind === 'capacitor') {
        throw new Error('Sign-out is not available in the reIS mobile app yet');
    }
    clearUserParamsCache();
    try {
        await IndexedDBService.clearAll();
    } catch (e) {
        logError('ProxyClient.logout:clearAll', e);
    }
    return executeAction('logout', {});
}

export function signalReady() { window.parent.postMessage(Messages.ready(), '*'); }
export function isInIframe(): boolean { try { return window.self !== window.parent; } catch { return true; } }
