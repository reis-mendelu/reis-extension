import { adminAuthClient } from '@/services/admin/authClient';
import { parseDiagnostics } from '@/types/schemas/diagnostics.schema';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import { devSuggestionsStore } from '@/utils/mock/devSuggestions';
import type {
  SuggestionRow,
  SuggestionStatus,
  SuggestionAttachment,
  SuggestionAttachmentSummary,
} from '@/types/suggestions';

// Reads run under the admin session, so RLS ("Admin read suggestions") is the
// gate — no service-role key is ever in the client. In dev:web the seeded
// session is fake and cannot satisfy RLS, so reads route to the mock store,
// mirroring how societyPosts routes CRUD to devSocietyStore.
//
// Returns `null` when the read fails so callers can distinguish "the read
// failed" from "there are genuinely no rows" — an empty array is always a
// genuine, authoritative result.
export async function listSuggestions(): Promise<SuggestionRow[] | null> {
  if (DEV_SOCIETY) return devSuggestionsStore.list();
  // The embed carries the attachment COUNTS only. The bytes stay on the server
  // until an admin opens a report — 200 rows of screenshots would be ~100 MB.
  const { data, error } = await adminAuthClient
    .from('suggestions')
    .select('*, suggestion_attachments(has_screenshot,diagnostics_count)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logError('Api.listSuggestions', error);
    return null;
  }
  return ((data ?? []) as RawRow[]).map(({ suggestion_attachments, ...r }) => ({
    ...r,
    attachments: flattenEmbed(suggestion_attachments),
  }));
}

type RawRow = Omit<SuggestionRow, 'attachments'> & {
  suggestion_attachments?: SuggestionAttachmentSummary | SuggestionAttachmentSummary[] | null;
};

// PostgREST embeds a one-to-one relation as an object, but older versions and
// some query shapes give an array. Accept both; no row means no attachments.
function flattenEmbed(
  e: SuggestionAttachmentSummary | SuggestionAttachmentSummary[] | null | undefined
): SuggestionAttachmentSummary | null {
  const one = Array.isArray(e) ? e[0] : e;
  return one ?? null;
}

/** PostgREST returns bytea as `\x` followed by hex. */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const body = hex.startsWith('\\x') ? hex.slice(2) : hex;
  const out = new Uint8Array(new ArrayBuffer(body.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!); // safe: i < length
  return btoa(binary);
}

/** One report's screenshot and diagnostics. Null when the read fails. */
export async function getSuggestionAttachments(id: number): Promise<SuggestionAttachment | null> {
  if (DEV_SOCIETY) return devSuggestionsStore.attachments(id);
  const { data, error } = await adminAuthClient
    .from('suggestion_attachments')
    .select('screenshot, diagnostics')
    .eq('suggestion_id', id)
    .maybeSingle();
  if (error) {
    logError('Api.getSuggestionAttachments', error);
    return null;
  }
  const row = data as {
    screenshot: string | null;
    diagnostics: SuggestionAttachment['diagnostics'];
  } | null;
  if (!row) return { screenshot: null, diagnostics: null };
  return {
    screenshot: row.screenshot
      ? `data:image/jpeg;base64,${bytesToBase64(hexToBytes(row.screenshot))}`
      : null,
    diagnostics: parseDiagnostics(row.diagnostics),
  };
}

// Only `status` is grantable to authenticated (see the migration), so any other
// column in this patch would be rejected by Postgres, not silently written.
export async function setSuggestionStatus(id: number, status: SuggestionStatus): Promise<boolean> {
  if (DEV_SOCIETY) {
    devSuggestionsStore.setStatus(id, status);
    return true;
  }
  // .select('id') is load-bearing: PostgREST reports no error when an UPDATE
  // matches zero rows, so a row deleted meanwhile — or one RLS refuses — would
  // otherwise report success and leave the optimistic value on screen forever.
  // An empty result is the only signal that nothing was written.
  const { data, error } = await adminAuthClient
    .from('suggestions')
    .update({ status })
    .eq('id', id)
    .select('id');
  if (error) {
    logError('Api.setSuggestionStatus', error);
    return false;
  }
  if (!data || data.length === 0) {
    logError('Api.setSuggestionStatus', new Error(`no row updated for id ${id}`));
    return false;
  }
  return true;
}
