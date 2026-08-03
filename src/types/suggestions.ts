export type SuggestionType = 'bug' | 'idea' | 'other';
export type SuggestionStatus = 'new' | 'triaged' | 'done';

export interface SuggestionDraft {
  type: SuggestionType;
  title: string;
  body: string;
  contact?: string;
}

export interface SuggestionPayload extends SuggestionDraft {
  screen: string;
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
  screen: string;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
  status: SuggestionStatus;
  created_at: string;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'invalid' | 'upstream' | 'offline' };
