import { z } from 'zod';

/**
 * Runtime schemas for the cross-context postMessage boundary (content script ↔
 * iframe app). The envelope and all primitive structural fields are validated;
 * `payload`/`data`/domain objects stay permissive (`z.unknown()` / bare object)
 * because they are already typed `unknown` and are narrowed downstream — the
 * goal here is to reject malformed *envelopes* before they are cast, not to
 * re-type the whole domain. `z.object` strips unknown keys, so these schemas
 * stay lenient toward additive changes and never drop a valid message.
 */

const dataRequestType = z.enum(['schedule', 'exams', 'subjects', 'files', 'all']);
const actionType = z.enum([
    'register_exam', 'unregister_exam', 'toggle_outlook_sync', 'download_file',
    'download_document', 'trigger_sync', 'trigger_drive_backup', 'push_notes',
    'refresh_exams', 'open_url', 'logout',
]);

// ── Iframe → Content ────────────────────────────────────────────────────────
const ReadyMsg = z.object({ type: z.literal('REIS_READY') });
const RequestDataMsg = z.object({ type: z.literal('REIS_REQUEST_DATA'), dataType: dataRequestType });
const FetchRequestMsg = z.object({
    type: z.literal('REIS_FETCH'),
    id: z.string(),
    url: z.string(),
    options: z.object({
        method: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().optional(),
        responseType: z.enum(['text', 'image']).optional(),
    }).optional(),
});
const ActionRequestMsg = z.object({
    type: z.literal('REIS_ACTION'),
    id: z.string(),
    action: actionType,
    payload: z.unknown(),
});
const IskamReadyMsg = z.object({ type: z.literal('ISKAM_READY') });
const IskamFetchBlockMsg = z.object({
    type: z.literal('ISKAM_FETCH_BLOCK'),
    id: z.string(), blockId: z.string(), od: z.string(), doo: z.string(),
});

export const IframeToContentSchema = z.discriminatedUnion('type', [
    ReadyMsg, RequestDataMsg, FetchRequestMsg, ActionRequestMsg, IskamReadyMsg, IskamFetchBlockMsg,
]);

// ── Content → Iframe ────────────────────────────────────────────────────────
const DataResponseMsg = z.object({
    type: z.literal('REIS_DATA'), dataType: dataRequestType, data: z.unknown(), error: z.string().optional(),
});
const FetchResultMsg = z.object({
    type: z.literal('REIS_FETCH_RESULT'), id: z.string(), success: z.boolean(),
    data: z.string().optional(), error: z.string().optional(),
});
const ActionResultMsg = z.object({
    type: z.literal('REIS_ACTION_RESULT'), id: z.string(), success: z.boolean(),
    data: z.unknown().optional(), error: z.string().optional(),
});
// `data` is the SyncedData envelope — validate it is an object (the consumer
// casts and reads fields off it); domain fields stay unvalidated by design.
const SyncUpdateMsg = z.object({
    type: z.literal('REIS_SYNC_UPDATE'),
    data: z.object({ lastSync: z.number().optional() }),
});
const PopupStateMsg = z.object({ type: z.literal('REIS_POPUP_STATE'), open: z.boolean() });
const NavChild = z.object({ id: z.string(), label: z.string(), labelEn: z.string().optional(), href: z.string() });
const NavCategory = z.object({
    id: z.string(), label: z.string(), icon: z.string().optional(),
    expandable: z.boolean().optional(), children: z.array(NavChild),
});
const NavMenuMsg = z.object({ type: z.literal('REIS_NAV_MENU'), categories: z.array(NavCategory) });
const IskamSyncUpdateMsg = z.object({
    type: z.literal('ISKAM_SYNC_UPDATE'),
    data: z.object({
        iskamData: z.unknown(),
        isSyncing: z.boolean(),
        error: z.enum(['auth', 'network']).nullable(),
    }),
});
const IskamBlockResultMsg = z.object({
    type: z.literal('ISKAM_BLOCK_RESULT'), id: z.string(), rooms: z.array(z.unknown()),
});
const TelemetryErrorMsg = z.object({
    type: z.literal('REIS_TELEMETRY_ERROR'), context: z.string(), message: z.string(),
});

export const ContentToIframeSchema = z.discriminatedUnion('type', [
    DataResponseMsg, FetchResultMsg, ActionResultMsg, SyncUpdateMsg, PopupStateMsg,
    NavMenuMsg, IskamSyncUpdateMsg, IskamBlockResultMsg, TelemetryErrorMsg,
]);
