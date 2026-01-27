import * as T from './messages/base';

export * from './messages/base';
export type { ActionType, DataRequestType } from './messages/base';

export function isIframeMessage(d: any): d is T.IframeToContentMessage { return ['REIS_READY', 'REIS_REQUEST_DATA', 'REIS_FETCH', 'REIS_ACTION'].includes(d?.type); }
export function isContentMessage(d: any): d is T.ContentToIframeMessage { return ['REIS_DATA', 'REIS_FETCH_RESULT', 'REIS_ACTION_RESULT', 'REIS_SYNC_UPDATE'].includes(d?.type); }

export const Messages = {
    ready: (): T.ReadyMessage => ({ type: 'REIS_READY' }),
    requestData: (t: T.DataRequestType): T.RequestDataMessage => ({ type: 'REIS_REQUEST_DATA', dataType: t }),
    fetch: (u: string, o?: any): T.FetchRequestMessage => ({ type: 'REIS_FETCH', id: crypto.randomUUID(), url: u, options: o }),
    action: (a: T.ActionType, p: any): T.ActionRequestMessage => ({ type: 'REIS_ACTION', id: crypto.randomUUID(), action: a, payload: p }),
    data: (t: T.DataRequestType, d: any, e?: string): T.DataResponseMessage => ({ type: 'REIS_DATA', dataType: t, data: d, error: e }),
    fetchResult: (id: string, s: boolean, d?: string, e?: string): T.FetchResultMessage => ({ type: 'REIS_FETCH_RESULT', id, success: s, data: d, error: e }),
    actionResult: (id: string, s: boolean, d?: any, e?: string): T.ActionResultMessage => ({ type: 'REIS_ACTION_RESULT', id, success: s, data: d, error: e }),
    syncUpdate: (d: T.SyncedData): T.SyncUpdateMessage => ({ type: 'REIS_SYNC_UPDATE', data: d })
};
