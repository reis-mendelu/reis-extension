import type { z } from 'zod';
import type { actionType as actionTypeSchema } from './schema';
import type { DualLanguageStudyPlan, StudyStats, StudyComparison } from '../studyPlan';
import type { IskamData } from '../iskam';
import type { SubjectZaznamnik } from '../zaznamnik';

export type DataRequestType = 'schedule' | 'exams' | 'subjects' | 'files' | 'all';
// Derived from the runtime validator, never written out by hand: a member that
// exists here but not in the Zod enum is a message the boundary silently drops
// (see the note in schema.ts). Adding an action means adding it in ONE place.
export type ActionType = z.infer<typeof actionTypeSchema>;

export interface SyncedData {
  schedule?: unknown;
  exams?: unknown;
  subjects?: unknown;
  files?: unknown;
  syllabuses?: unknown;
  cvicneTests?: unknown;
  odevzdavarny?: unknown;
  classmates?: Record<string, unknown>;
  attendance?: Record<string, unknown>;
  pastAttendance?: Record<string, unknown>;
  zaznamnik?: Record<string, SubjectZaznamnik | null>;
  studyPlan?: DualLanguageStudyPlan;
  studyStats?: StudyStats;
  studyComparison?: StudyComparison;
  notes?: Record<string, Record<string, { note: string; fileName: string }>>;
  isSyncing?: boolean;
  lastSync: number;
  error?: string;
}

export interface ReadyMessage {
  type: 'REIS_READY';
}
export interface RequestDataMessage {
  type: 'REIS_REQUEST_DATA';
  dataType: DataRequestType;
}
export interface FetchRequestMessage {
  type: 'REIS_FETCH';
  id: string;
  url: string;
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    responseType?: 'text' | 'image';
  };
}
export interface ActionRequestMessage {
  type: 'REIS_ACTION';
  id: string;
  action: ActionType;
  payload: unknown;
}

export interface DataResponseMessage {
  type: 'REIS_DATA';
  dataType: DataRequestType;
  data: unknown;
  error?: string;
}
export interface FetchResultMessage {
  type: 'REIS_FETCH_RESULT';
  id: string;
  success: boolean;
  data?: string;
  error?: string;
}
// `demoMode` marks a failure as DemoModeError rather than a real fault. Needed
// because on Capacitor this reply loops back through postMessage to the app's
// own window (see sendToIframe) purely to reuse this listener — there is no
// real process boundary — and that hop otherwise stringifies the error, so the
// receiving end could no longer tell a blocked demo tap from a genuine one.
export interface ActionResultMessage {
  type: 'REIS_ACTION_RESULT';
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  demoMode?: boolean;
}
export interface SyncUpdateMessage {
  type: 'REIS_SYNC_UPDATE';
  data: SyncedData;
}
export interface PopupStateMessage {
  type: 'REIS_POPUP_STATE';
  open: boolean;
}
export interface NavMenuMessage {
  type: 'REIS_NAV_MENU';
  categories: {
    id: string;
    label: string;
    icon?: string;
    expandable?: boolean;
    children: { id: string; label: string; labelEn?: string; href: string }[];
  }[];
}

export interface IskamReadyMessage {
  type: 'ISKAM_READY';
}
export interface IskamSyncUpdateMessage {
  type: 'ISKAM_SYNC_UPDATE';
  data: {
    iskamData: IskamData | null;
    isSyncing: boolean;
    error: 'auth' | 'network' | null;
  };
}
export interface IskamFetchBlockMessage {
  type: 'ISKAM_FETCH_BLOCK';
  id: string;
  blockId: string;
  od: string;
  doo: string;
}
export interface IskamBlockResultMessage {
  type: 'ISKAM_BLOCK_RESULT';
  id: string;
  rooms: import('../iskam').VolneKapacityRoom[];
}

// Sent by content scripts to route explicit error telemetry through the iframe
// (which has Supabase access). Context must contain no student data.
export interface TelemetryErrorMessage {
  type: 'REIS_TELEMETRY_ERROR';
  context: string;
  message: string;
}

export type IframeToContentMessage =
  | ReadyMessage
  | RequestDataMessage
  | FetchRequestMessage
  | ActionRequestMessage
  | IskamReadyMessage
  | IskamFetchBlockMessage;
export type ContentToIframeMessage =
  | DataResponseMessage
  | FetchResultMessage
  | ActionResultMessage
  | SyncUpdateMessage
  | PopupStateMessage
  | NavMenuMessage
  | IskamSyncUpdateMessage
  | IskamBlockResultMessage
  | TelemetryErrorMessage;
