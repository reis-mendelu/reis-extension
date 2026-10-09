import { ORGANIZERS, type FacultyKey, type Society } from '../types/events';

/**
 * Who a partner company is shown to (spec 2026-10-09). Matching happens on the
 * student's device; a partner never learns who matched. Both regexes must stay
 * identical to the CHECKs in supabase/migrations/20261011120000_partner_targeting.sql.
 */
// 'mendelu' (everyone) takes no programme: a programme belongs to a faculty.
export const AUDIENCE_TOKEN_RE = /^(mendelu|(pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?)$/;
export const PROGRAMME_RE = /^[A-Z]-[A-Z0-9]{1,10}$/;

/** 'B-OI-ZBOI' → 'B-OI'. Null when the code is missing or not programme-shaped. */
export function baseProgramme(code: string | null | undefined): string | null {
  if (!code) return null;
  const [level, programme] = code.trim().toUpperCase().split('-');
  if (!level || !programme) return null;
  const base = `${level}-${programme}`;
  return PROGRAMME_RE.test(base) ? base : null;
}

export function isPartner(society: Society | undefined): boolean {
  return society?.kind === 'partner';
}

export interface AudienceViewer {
  facultyKey: FacultyKey | null;
  programme?: string | null;
}

/** Any token matching is enough. An unknown faculty matches nothing. */
export function matchesAudience(
  audience: readonly string[] | null | undefined,
  viewer: AudienceViewer
): boolean {
  if (!audience?.length || !viewer.facultyKey) return false;
  return audience.some((token) => {
    const [faculty, programme] = token.split(':');
    if (faculty === 'mendelu') return true;
    if (faculty !== viewer.facultyKey) return false;
    return programme === undefined || programme === (viewer.programme ?? null);
  });
}

/** The partners a student is shown: active, matching, in catalog order. */
export function matchingPartners(
  catalog: Record<string, Society>,
  viewer: AudienceViewer
): Society[] {
  return Object.values(catalog)
    .filter((s) => s.isActive && isPartner(s) && matchesAudience(s.audience, viewer))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Admin form state: a key present = chip on; value = comma list ('' = whole faculty). */
export type AudienceDraft = Partial<Record<FacultyKey, string>>;

export function audienceFromDraft(draft: AudienceDraft): string[] | 'invalid' {
  const tokens: string[] = [];
  // The draft's own key order, so tokens come out in the order the admin set them.
  for (const faculty of Object.keys(draft) as FacultyKey[]) {
    if (!(faculty in ORGANIZERS)) return 'invalid';
    const list = draft[faculty];
    if (list === undefined) continue;
    const codes = list
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((c) => c.toUpperCase());
    if (codes.length === 0) tokens.push(faculty);
    else tokens.push(...codes.map((c) => `${faculty}:${c}`));
  }
  if (tokens.length === 0 || !tokens.every((t) => AUDIENCE_TOKEN_RE.test(t))) return 'invalid';
  return tokens;
}

export function draftFromAudience(audience: readonly string[] | null | undefined): AudienceDraft {
  const draft: AudienceDraft = {};
  for (const token of audience ?? []) {
    const [faculty, programme] = token.split(':') as [FacultyKey, string | undefined];
    const prev = draft[faculty];
    // A faculty-wide token already covers that faculty's programmes, so it
    // wins: saving the draft must never narrow 'pef' + 'pef:B-OI' to B-OI.
    if (!programme || prev === '') draft[faculty] = '';
    else draft[faculty] = prev ? `${prev}, ${programme}` : programme;
  }
  return draft;
}
