import * as T from './messages/base';
import { IframeToContentSchema, ContentToIframeSchema } from './messages/schema';

export * from './messages/base';
export type { ActionType, DataRequestType } from './messages/base';

// Runtime-validated at the trust boundary via Zod (see ./messages/schema.ts):
// the envelope + primitive fields are checked, so a malformed message is
// dropped rather than cast blindly. Type predicates keep call sites unchanged.
export function isIframeMessage(d: unknown): d is T.IframeToContentMessage { return IframeToContentSchema.safeParse(d).success; }
export function isContentMessage(d: unknown): d is T.ContentToIframeMessage { return ContentToIframeSchema.safeParse(d).success; }

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
    navMenu: (categories: T.NavMenuMessage['categories']): T.NavMenuMessage => ({ type: 'REIS_NAV_MENU', categories }),
    telemetryError: (context: string, err: unknown): T.TelemetryErrorMessage => ({
        type: 'REIS_TELEMETRY_ERROR',
        context,
        message: err instanceof Error ? err.message : String(err),
    })
};

export const IskamMessages = {
    iskamReady: (): T.IskamReadyMessage => ({ type: 'ISKAM_READY' }),
    iskamSyncUpdate: (
        iskamData: T.IskamSyncUpdateMessage['data']['iskamData'],
        isSyncing: boolean,
        error: T.IskamSyncUpdateMessage['data']['error'],
    ): T.IskamSyncUpdateMessage => ({ type: 'ISKAM_SYNC_UPDATE', data: { iskamData, isSyncing, error } }),
};
