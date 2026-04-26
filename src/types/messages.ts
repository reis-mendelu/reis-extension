import * as T from './messages/base';

export * from './messages/base';
export type { ActionType, DataRequestType } from './messages/base';

export function isIframeMessage(d: unknown): d is T.IframeToContentMessage { return typeof d === 'object' && d !== null && 'type' in d && ['REIS_READY', 'REIS_REQUEST_DATA', 'REIS_FETCH', 'REIS_ACTION', 'ISKAM_READY'].includes((d as any).type); }
export function isContentMessage(d: unknown): d is T.ContentToIframeMessage { return typeof d === 'object' && d !== null && 'type' in d && ['REIS_DATA', 'REIS_FETCH_RESULT', 'REIS_ACTION_RESULT', 'REIS_SYNC_UPDATE', 'REIS_POPUP_STATE', 'REIS_NAV_MENU', 'ISKAM_SYNC_UPDATE'].includes((d as any).type); }

export const Messages = {
    ready: (): T.ReadyMessage => ({ type: 'REIS_READY' }),
    requestData: (t: T.DataRequestType): T.RequestDataMessage => ({ type: 'REIS_REQUEST_DATA', dataType: t }),
    fetch: (u: string, o?: T.FetchRequestMessage['options']): T.FetchRequestMessage => ({ type: 'REIS_FETCH', id: crypto.randomUUID(), url: u, options: o }),
    action: (a: T.ActionType, p: unknown): T.ActionRequestMessage => ({ type: 'REIS_ACTION', id: crypto.randomUUID(), action: a, payload: p }),
    data: (t: T.DataRequestType, d: unknown, e?: string): T.DataResponseMessage => ({ type: 'REIS_DATA', dataType: t, data: d, error: e }),
    fetchResult: (id: string, s: boolean, d?: string, e?: string): T.FetchResultMessage => ({ type: 'REIS_FETCH_RESULT', id, success: s, data: d, error: e }),
    actionResult: (id: string, s: boolean, d?: unknown, e?: string): T.ActionResultMessage => ({ type: 'REIS_ACTION_RESULT', id, success: s, data: d, error: e }),
    syncUpdate: (d: T.SyncedData): T.SyncUpdateMessage => ({ type: 'REIS_SYNC_UPDATE', data: d }),
    popupState: (open: boolean): T.PopupStateMessage => ({ type: 'REIS_POPUP_STATE', open }),
    navMenu: (categories: T.NavMenuMessage['categories']): T.NavMenuMessage => ({ type: 'REIS_NAV_MENU', categories })
};

export const IskamMessages = {
    iskamReady: (): T.IskamReadyMessage => ({ type: 'ISKAM_READY' }),
    iskamSyncUpdate: (
        iskamData: T.IskamSyncUpdateMessage['data']['iskamData'],
        isSyncing: boolean,
        error: T.IskamSyncUpdateMessage['data']['error'],
    ): T.IskamSyncUpdateMessage => ({ type: 'ISKAM_SYNC_UPDATE', data: { iskamData, isSyncing, error } }),
};
