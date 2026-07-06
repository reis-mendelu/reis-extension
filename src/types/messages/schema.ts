import { z } from 'zod';
import { IskamDataSchema } from '../storage';

/**
 * Runtime schemas for the cross-context postMessage boundary (content script ↔
 * iframe app). The envelope and all primitive structural fields are validated;
 * `payload`/`data`/domain objects stay permissive (`z.unknown()` / bare object)
 * because they are already typed `unknown` and are narrowed downstream — the
 * goal here is to reject malformed *envelopes* before they are cast, not to
 * re-type the whole domain. `z.object` strips unknown keys, so these schemas
 * stay lenient toward additive changes and never drop a valid message.
 */

// SyncedData is the persisted sync payload pushed content→iframe on EVERY sync.
// `isContentMessage` is fail-closed with WHOLE-PAYLOAD blast radius: if this
// schema rejects, the entire sync update is dropped and the whole app shows an
// empty state. So we guard ONLY the three stably-typed primitives (+ that the
// envelope is an object). Every domain field is left permissive on purpose:
// they are typed `unknown`/variable and legitimately arrive in different shapes
// down different sync paths — e.g. syncService sends `exams` as a flat array but
// `schedule` as a dual-language `{cz,en}` object, and the factory emits
// `schedule: {}`. Their deep content is already validated at the IDB boundary
// (StoreSchemas); guarding their shape here would risk dropping a whole payload.
// z.object passes extra keys, so all of them (and future additions) flow through.
const SyncedDataSchema = z.object({
  lastSync: z.number().optional(),
  isSyncing: z.boolean().optional(),
  error: z.string().optional(),
});

const dataRequestType = z.enum(['schedule', 'exams', 'subjects', 'files', 'all']);
const actionType = z.enum([
  'register_exam',
  'unregister_exam',
  'toggle_outlook_sync',
  'download_file',
  'download_document',
  'trigger_sync',
  'trigger_drive_backup',
  'push_notes',
  'refresh_exams',
  'open_url',
  'logout',
]);

// ── Iframe → Content ────────────────────────────────────────────────────────
const ReadyMsg = z.object({ type: z.literal('REIS_READY') });
const RequestDataMsg = z.object({
  type: z.literal('REIS_REQUEST_DATA'),
  dataType: dataRequestType,
});
const FetchRequestMsg = z.object({
  type: z.literal('REIS_FETCH'),
  id: z.string(),
  url: z.string(),
  options: z
    .object({
      method: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
      responseType: z.enum(['text', 'image']).optional(),
    })
    .optional(),
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
  id: z.string(),
  blockId: z.string(),
  od: z.string(),
  doo: z.string(),
});

export const IframeToContentSchema = z.discriminatedUnion('type', [
  ReadyMsg,
  RequestDataMsg,
  FetchRequestMsg,
  ActionRequestMsg,
  IskamReadyMsg,
  IskamFetchBlockMsg,
]);

// ── Content → Iframe ────────────────────────────────────────────────────────
const DataResponseMsg = z.object({
  type: z.literal('REIS_DATA'),
  dataType: dataRequestType,
  data: z.unknown(),
  error: z.string().optional(),
});
const FetchResultMsg = z.object({
  type: z.literal('REIS_FETCH_RESULT'),
  id: z.string(),
  success: z.boolean(),
  data: z.string().optional(),
  error: z.string().optional(),
});
const ActionResultMsg = z.object({
  type: z.literal('REIS_ACTION_RESULT'),
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
const SyncUpdateMsg = z.object({
  type: z.literal('REIS_SYNC_UPDATE'),
  data: SyncedDataSchema,
});
const PopupStateMsg = z.object({ type: z.literal('REIS_POPUP_STATE'), open: z.boolean() });
const NavChild = z.object({
  id: z.string(),
  label: z.string(),
  labelEn: z.string().optional(),
  href: z.string(),
});
const NavCategory = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  expandable: z.boolean().optional(),
  children: z.array(NavChild),
});
const NavMenuMsg = z.object({ type: z.literal('REIS_NAV_MENU'), categories: z.array(NavCategory) });
const IskamSyncUpdateMsg = z.object({
  type: z.literal('ISKAM_SYNC_UPDATE'),
  data: z.object({
    // Reuses the store's IskamDataSchema — safe because it's a single
    // coherent object gated identically at the IDB 'iskam' boundary, so no
    // data that currently reaches IDB is newly dropped here. Nullable: the
    // payload carries null before the first successful ISKAM sync.
    iskamData: IskamDataSchema.nullable(),
    isSyncing: z.boolean(),
    error: z.enum(['auth', 'network']).nullable(),
  }),
});
const IskamBlockResultMsg = z.object({
  type: z.literal('ISKAM_BLOCK_RESULT'),
  id: z.string(),
  rooms: z.array(z.unknown()),
});
const TelemetryErrorMsg = z.object({
  type: z.literal('REIS_TELEMETRY_ERROR'),
  context: z.string(),
  message: z.string(),
});

export const ContentToIframeSchema = z.discriminatedUnion('type', [
  DataResponseMsg,
  FetchResultMsg,
  ActionResultMsg,
  SyncUpdateMsg,
  PopupStateMsg,
  NavMenuMsg,
  IskamSyncUpdateMsg,
  IskamBlockResultMsg,
  TelemetryErrorMsg,
]);
