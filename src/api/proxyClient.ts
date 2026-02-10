import { Messages } from '../types/messages';
import * as MsgTypes from '../types/messages/base';
import type { ActionType } from '../types/messages';
import { pendingFetches, pendingActions, REQUEST_TIMEOUT } from './proxy/pendingRequests';
import { initProxyListener } from './proxy/messageListener';

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
        pendingActions.set(msg.id, { resolve, reject, timeout });
        window.parent.postMessage(msg, '*');
    });
}

export function requestData(t: string) { window.parent.postMessage(Messages.requestData(t as any), '*'); }
export function signalReady() { window.parent.postMessage(Messages.ready(), '*'); }
export function isInIframe(): boolean { try { return window.self !== window.parent; } catch { return true; } }
