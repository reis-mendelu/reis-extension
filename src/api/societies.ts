import { supabase } from '../services/spolky/supabaseClient';
import { SUPABASE_URL } from '../services/supabase/config';
import { ORGANIZERS, type FacultyKey, type Society } from '../types/events';
import { glyphFor } from '../utils/societies/resolveSociety';
import { logError } from '../utils/reportError';

export const SOCIETY_LOGO_BUCKET = 'society-logos';

export interface SocietyRow {
  id: string;
  name: string;
  short_name: string;
  color: string;
  faculty_key: string;
  auto_follow_faculty: boolean;
  audience_label: string | null;
  logo_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export const SOCIETY_COLUMNS =
  'id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, logo_path, sort_order, is_active';

export function logoPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SOCIETY_LOGO_BUCKET}/${path}`;
}

function isFacultyKey(value: string): value is FacultyKey {
  return value in ORGANIZERS;
}

/** Null for a row this client cannot place: a faculty added after this build. */
export function rowToSociety(row: SocietyRow): Society | null {
  if (!isFacultyKey(row.faculty_key)) return null;
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    glyph: glyphFor(row.short_name),
    ...(row.logo_path ? { logo: logoPublicUrl(row.logo_path) } : {}),
    facultyKey: row.faculty_key,
    autoFollowFaculty: row.auto_follow_faculty,
    audienceLabel: row.audience_label === 'erasmus' ? 'erasmus' : null,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/**
 * The whole catalog, hidden societies included: an old event still needs its
 * society's name. Anonymous read of public branding, with no identity and no
 * student data in either direction.
 */
export async function fetchSocieties(): Promise<Society[] | null> {
  const { data, error } = await supabase
    .from('societies')
    .select(SOCIETY_COLUMNS)
    .order('sort_order', { ascending: true });
  if (error) {
    logError('Api.fetchSocieties', error);
    return null;
  }
  return ((data ?? []) as SocietyRow[]).map(rowToSociety).filter((s): s is Society => s !== null);
}
