import type { DualLanguageStudyPlan, StudyStats } from '../studyPlan';

export type DataRequestType = 'schedule' | 'exams' | 'subjects' | 'files' | 'assessments' | 'all';
export type ActionType = 'register_exam' | 'unregister_exam' | 'toggle_outlook_sync' | 'download_file' | 'trigger_sync' | 'open_url' | 'logout';

export interface SyncedData { schedule?: unknown; exams?: unknown; subjects?: unknown; files?: unknown; assessments?: unknown; syllabuses?: unknown; cvicneTests?: unknown; odevzdavarny?: unknown; classmates?: Record<string, unknown>; attendance?: Record<string, unknown>; studyPlan?: DualLanguageStudyPlan; studyStats?: StudyStats; isSyncing?: boolean; lastSync: number; error?: string; }


export interface ReadyMessage { type: 'REIS_READY'; }
export interface RequestDataMessage { type: 'REIS_REQUEST_DATA'; dataType: DataRequestType; }
export interface FetchRequestMessage { type: 'REIS_FETCH'; id: string; url: string; options?: { method?: string; headers?: Record<string, string>; body?: string; }; }
export interface ActionRequestMessage { type: 'REIS_ACTION'; id: string; action: ActionType; payload: unknown; }

export type IframeToContentMessage = ReadyMessage | RequestDataMessage | FetchRequestMessage | ActionRequestMessage;

export interface DataResponseMessage { type: 'REIS_DATA'; dataType: DataRequestType; data: unknown; error?: string; }
export interface FetchResultMessage { type: 'REIS_FETCH_RESULT'; id: string; success: boolean; data?: string; error?: string; }
export interface ActionResultMessage { type: 'REIS_ACTION_RESULT'; id: string; success: boolean; data?: unknown; error?: string; }
export interface SyncUpdateMessage { type: 'REIS_SYNC_UPDATE'; data: SyncedData; }
export interface PopupStateMessage { type: 'REIS_POPUP_STATE'; open: boolean; }
export interface NavMenuMessage { type: 'REIS_NAV_MENU'; categories: { id: string; label: string; icon?: string; expandable?: boolean; children: { id: string; label: string; labelEn?: string; href: string }[] }[]; }

export type ContentToIframeMessage = DataResponseMessage | FetchResultMessage | ActionResultMessage | SyncUpdateMessage | PopupStateMessage | NavMenuMessage;
