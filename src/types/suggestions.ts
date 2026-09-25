import type { AppView } from './app';
import type { DiagnosticsPayload } from '../utils/diagnostics/collectDiagnostics';

export type SuggestionType = 'bug' | 'idea' | 'other';
export type SuggestionStatus = 'new' | 'triaged' | 'done';

export interface SuggestionDraft {
  type: SuggestionType;
  title: string;
  body: string;
  contact?: string;
}

export interface SuggestionPayload extends SuggestionDraft {
  // AppView, not string: the screen allowlist is enforced at runtime in the
  // edge function, the DB constraint and resolveScreen. Typing it as `string`
  // meant a typo at a call site would only surface as a 400 in production.
  screen: AppView;
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
  screen: AppView;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
  status: SuggestionStatus;
  created_at: string;
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
