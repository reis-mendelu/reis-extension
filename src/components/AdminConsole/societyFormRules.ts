import type { FacultyKey, Society } from '../../types/events';
import { isUsablePinColor } from '../../utils/societies/pinColor';

// The add/edit society form's rules, kept pure so they are testable without
// rendering the form.

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

export interface SocietyDraft {
  id: string;
  name: string;
  shortName: string;
  color: string;
  hasLogo: boolean;
}

/** An i18n key under admin.societies, or null when the draft may be saved. */
export function validateSocietyDraft(
  draft: SocietyDraft,
  isNew: boolean,
  catalog: Record<string, Society>
): string | null {
  if (isNew && !ID_RE.test(draft.id)) return 'errors.id';
  if (isNew && catalog[draft.id]) return 'errors.idTaken';
  if (!draft.name.trim() || !draft.shortName.trim()) return 'errors.required';
  if (!isUsablePinColor(draft.color)) return 'errors.color';
  if (isNew && !draft.hasLogo) return 'errors.logo_required';
  return null;
}

/**
 * The society currently holding this faculty's auto-follow, other than `id`.
 * Hidden societies count: the database's one-per-faculty index ignores
 * is_active, so a hidden holder still blocks a new default until released.
 */
export function autoFollowHolder(
  catalog: Record<string, Society>,
  facultyKey: FacultyKey,
  id: string
): Society | undefined {
  return Object.values(catalog).find(
    (s) => s.autoFollowFaculty && s.facultyKey === facultyKey && s.id !== id
  );
}
