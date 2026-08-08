import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import { devSuggestionsStore } from '@/utils/mock/devSuggestions';
import type { SuggestionRow, SuggestionStatus } from '@/types/suggestions';

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
  const { data, error } = await adminAuthClient
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logError('Api.listSuggestions', error);
    return null;
  }
  return (data ?? []) as SuggestionRow[];
}

// Only `status` is grantable to authenticated (see the migration), so any other
// column in this patch would be rejected by Postgres, not silently written.
export async function setSuggestionStatus(id: number, status: SuggestionStatus): Promise<boolean> {
  if (DEV_SOCIETY) {
    devSuggestionsStore.setStatus(id, status);
    return true;
  }
  const { error } = await adminAuthClient.from('suggestions').update({ status }).eq('id', id);
  if (error) {
    logError('Api.setSuggestionStatus', error);
    return false;
  }
  return true;
}
