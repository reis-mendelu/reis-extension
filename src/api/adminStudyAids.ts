import { z } from 'zod';
import { adminAuthClient } from '../services/admin/authClient';
import { DEV_SOCIETY } from '../utils/mock/devSociety';
import { devStudyAidsStore } from '../utils/mock/devStudyAids';
import { logError } from '../utils/reportError';

// The console's side of the study-aids links: read every row (switched off ones
// too) and change one's audience or switch. reis_admin only, by RLS; the console
// gating on the role is a convenience, never the authorization. There is no
// insert and no delete: a link exists because a migration seeded its row and
// `data/studyAids.ts` knows it.
// Under VITE_DEV_SOCIETY (npm run dev:web) the session is fake, so these run
// against an in-memory store and never reach Supabase. Never cite them as
// evidence the write path works.

export interface AdminStudyAids {
  id: string;
  /** Faculty and programme tokens, the shape a partner's audience has (`af:B-ATE`). */
  audience: string[];
  isActive: boolean;
}

const RowSchema = z.object({
  id: z.string(),
  audience: z.array(z.string()),
  is_active: z.boolean(),
});

export async function fetchAdminStudyAids(): Promise<AdminStudyAids[] | null> {
  if (DEV_SOCIETY) return devStudyAidsStore.list();
  const { data, error } = await adminAuthClient
    .from('study_aids')
    .select('id, audience, is_active')
    .order('id');
  if (error || !Array.isArray(data)) {
    logError('Api.fetchAdminStudyAids', error ?? new Error('malformed study_aids'));
    return null;
  }
  return data.flatMap((raw) => {
    const r = RowSchema.safeParse(raw);
    return r.success
      ? [{ id: r.data.id, audience: r.data.audience, isActive: r.data.is_active }]
      : [];
  });
}

export async function saveAdminStudyAids(
  id: string,
  patch: Pick<AdminStudyAids, 'audience' | 'isActive'>
): Promise<boolean> {
  if (DEV_SOCIETY) return devStudyAidsStore.save(id, patch);
  const { error } = await adminAuthClient
    .from('study_aids')
    .update({
      audience: patch.audience,
      is_active: patch.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) logError('Api.saveAdminStudyAids', error);
  return !error;
}
