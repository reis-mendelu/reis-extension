import { adminAuthClient } from '../services/admin/authClient';
import { hashBytes } from '../services/notes/imageNormalize';
import { DEV_SOCIETY } from '../utils/mock/devSociety';
import { logError } from '../utils/reportError';
import type { FacultyKey, Society } from '../types/events';
import { SOCIETY_COLUMNS, SOCIETY_LOGO_BUCKET, rowToSociety, type SocietyRow } from './societies';

// Admin writes to the societies catalog. RLS lets only reis_admin through; the
// console gating on the role is a convenience, never the authorization.
// Under VITE_DEV_SOCIETY (npm run dev:web) the session is fake and cannot pass
// RLS, so writes succeed locally and never reach Supabase. Never cite them as
// evidence the write path works.

export interface SocietyInput {
  id: string;
  name: string;
  shortName: string;
  color: string;
  facultyKey: FacultyKey;
  autoFollowFaculty: boolean;
}

/** Content-addressed, so a replaced logo is a new URL no CDN has cached. */
export async function logoObjectPath(id: string, png: Blob): Promise<string> {
  const hex = await hashBytes(await png.arrayBuffer());
  return `${id}/${hex.slice(0, 32)}.png`;
}

export async function uploadSocietyLogo(id: string, png: Blob): Promise<string | null> {
  const path = await logoObjectPath(id, png);
  if (DEV_SOCIETY) return path;
  const { error } = await adminAuthClient.storage
    .from(SOCIETY_LOGO_BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
  // Same bytes, same path: a retry after a failed row save lands here.
  if (error && !/already exists/i.test(error.message)) {
    logError('Api.uploadSocietyLogo', error);
    return null;
  }
  return path;
}

export async function removeSocietyLogo(path: string): Promise<void> {
  if (DEV_SOCIETY) return;
  const { error } = await adminAuthClient.storage.from(SOCIETY_LOGO_BUCKET).remove([path]);
  // An orphaned file costs a few KB; it must never fail the save it follows.
  if (error) logError('Api.removeSocietyLogo', error);
}

function devRow(row: Partial<SocietyRow> & { id: string }): Society | null {
  return rowToSociety({
    name: row.id,
    short_name: row.id,
    color: '#6b7280',
    faculty_key: 'mendelu',
    auto_follow_faculty: false,
    audience_label: null,
    logo_path: null,
    sort_order: 0,
    is_active: true,
    ...row,
  });
}

export async function insertSociety(
  input: SocietyInput,
  logoPath: string,
  sortOrder: number
): Promise<Society | null> {
  const row = {
    id: input.id,
    name: input.name.trim(),
    short_name: input.shortName.trim(),
    color: input.color,
    faculty_key: input.facultyKey,
    auto_follow_faculty: input.autoFollowFaculty,
    logo_path: logoPath,
    sort_order: sortOrder,
  };
  if (DEV_SOCIETY) return devRow(row);
  const { data, error } = await adminAuthClient
    .from('societies')
    .insert(row)
    .select(SOCIETY_COLUMNS)
    .single();
  if (error || !data) {
    logError('Api.insertSociety', error);
    return null;
  }
  return rowToSociety(data as SocietyRow);
}

export async function updateSociety(
  id: string,
  patch: Partial<SocietyRow>
): Promise<Society | null> {
  if (DEV_SOCIETY) return devRow({ id, ...patch });
  const { data, error } = await adminAuthClient
    .from('societies')
    .update(patch)
    .eq('id', id)
    .select(SOCIETY_COLUMNS)
    .single();
  if (error || !data) {
    logError('Api.updateSociety', error);
    return null;
  }
  return rowToSociety(data as SocietyRow);
}
