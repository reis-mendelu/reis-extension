import type { DualLanguageStudyPlan, StudyStats, StudyComparison } from '../studyPlan';
import type { SubjectZaznamnik } from '../zaznamnik';

export type DataRequestType = 'schedule' | 'exams' | 'subjects' | 'files' | 'all';
export type ActionType =
  | 'register_exam'
  | 'unregister_exam'
  | 'download_file'
  | 'download_document'
  | 'trigger_sync'
  | 'refresh_exams'
  | 'refresh_schedule'
  | 'get_diagnostics'
  | 'open_url'
  | 'logout';

/**
 * A Phase 2 domain whose fetch can finish with a legitimately empty answer.
 *
 * "No exams this month" and "your exams have not arrived yet" are the same
 * payload without this: an absent or empty array either way. The screens need
 * to tell them apart, or a student whose real answer is nothing sits on a
 * loading state until the entire crawl ends.
 *
 * The study plan is deliberately absent from this union. Its fetch is
 * TTL-gated, so a null result means "skipped as fresh" and "there is none" and
 * "no studium this run" alike — and the Předměty screen releasing on that said
 * "Zatím žádné předměty" to a student who has plenty. That screen waits for a
 * usable plan or for the sync to finish, and nothing shorter.
 */
export type SyncDomain = 'schedule' | 'exams';

export interface SyncedData {
  /** Domains whose fetch has completed in this run, empty results included. */
  loaded?: SyncDomain[];
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
    // 'bytes': fetchAuthedBytes (eduroam) — base64 of the body, HTML refused.
    // 'file': bytes for the iframe as a FileFetchPayload JSON string, with
    // REIS_FETCH_PROGRESS ticks while the body arrives.
    responseType?: 'text' | 'image' | 'bytes' | 'file';
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
/**
 * The `data` of a successful 'file' fetch, JSON-encoded. Base64 because the
 * reply carries a string; the headers ride along because the iframe needs the
 * filename and the type, and it never sees the Response.
 */
export interface FileFetchPayload {
  contentType: string | null;
  contentDisposition: string | null;
  base64: string;
}
/** Bytes received so far on a 'file' fetch. Also re-arms its timeout. */
export interface FetchProgressMessage {
  type: 'REIS_FETCH_PROGRESS';
  id: string;
  loaded: number;
  total: number | null;
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

// Sent by content scripts to route explicit error telemetry through the iframe
// (which has Supabase access). Context must contain no student data.
export type IframeToContentMessage =
  ReadyMessage | RequestDataMessage | FetchRequestMessage | ActionRequestMessage;
export type ContentToIframeMessage =
  | DataResponseMessage
  | FetchResultMessage
  | FetchProgressMessage
  | ActionResultMessage
  | SyncUpdateMessage
  | PopupStateMessage
  | NavMenuMessage;
