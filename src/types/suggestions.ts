import type { AppView } from './app';
import type { MobileTab } from '../store/types';
import type { DiagnosticsPayload } from '../utils/diagnostics/collectDiagnostics';

export type SuggestionType = 'bug' | 'idea' | 'other';
export type SuggestionStatus = 'new' | 'triaged' | 'done';

export interface SuggestionDraft {
  type: SuggestionType;
  title: string;
  body: string;
  contact?: string;
}

/**
 * Where a report was written: a desktop view, or a phone tab. `profile` is the
 * one tab with no desktop view of the same name, and it is where most phone
 * reports start. Not added to `APP_VIEWS`: that list also validates the stored
 * desktop view on boot, and `profile` there would boot the desktop onto a
 * screen nothing renders.
 */
export type ReportScreen = AppView | MobileTab;

export interface SuggestionPayload extends SuggestionDraft {
  // A union, not string, so a typo at a call site fails typecheck. The server
  // checks only the length (1–40, in the RPC and on the table), so a
  // new value here needs no migration and breaks no released build.
  screen: ReportScreen;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
}

export interface SuggestionRow {
  id: number;
  type: SuggestionType;
  title: string;
  body: string;
  contact: string | null;
  screen: ReportScreen;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
  status: SuggestionStatus;
  created_at: string;
  /** Counts only — the bytes load on demand. Null when the report has none. */
  attachments?: SuggestionAttachmentSummary | null;
}

export interface SuggestionAttachmentSummary {
  has_screenshot: boolean;
  diagnostics_count: number;
}

/** One report's attachments, loaded when an admin opens them. */
export interface SuggestionAttachment {
  /** A `data:` URL — no object URL to revoke, and at ≤ 600 KB it is cheap to hold. */
  screenshot: string | null;
  diagnostics: DiagnosticsPayload | null;
}

/** What the student chose to attach. Both absent unless they acted. */
export interface SuggestionAttachmentsDraft {
  diagnostics?: DiagnosticsPayload | null;
  /** JPEG bytes as base64, no `data:` prefix — see utils/diagnostics/encodeScreenshot. */
  screenshotBase64?: string | null;
}

export type SubmitResult =
  | { ok: true; screenshotDropped?: true }
  | { ok: false; error: 'rate_limited' | 'invalid' | 'upstream' | 'offline' };
