import type { Society } from '../../types/events';
import { isUsablePinColor } from '../../utils/societies/pinColor';
import { isInstagramHandle } from '../../utils/societies/instagramHandle';

// The add/edit society form's rules, kept pure so they are testable without
// rendering the form.

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
export const NAME_MAX = 80;
// Instagram's own first path segments: a post, reel, story or account URL
// names no profile, and its segment ("p", "reel") would pass as a handle.
const NOT_A_PROFILE = /^(p|reel|reels|explore|accounts|stories|tv|direct)$/i;

/** The handle to store, null for none, or 'invalid'. At least as strict as the DB CHECK. */
export function normalizeInstagram(raw: string): string | null | 'invalid' {
  let s = raw.trim();
  if (!s) return null;
  const url = /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(s);
  if (url) {
    if (NOT_A_PROFILE.test(url[1]!)) return 'invalid';
    s = url[1]!;
  }
  s = s.replace(/^@/, '');
  return isInstagramHandle(s) ? s : 'invalid';
}

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
  // The DB CHECK: 1..80 after btrim (societies_catalog.sql). Short name is
  // capped by its input's maxLength 24.
  if (draft.name.trim().length > NAME_MAX) return 'errors.nameTooLong';
  if (!isUsablePinColor(draft.color)) return 'errors.color';
  if (isNew && !draft.hasLogo) return 'errors.logo_required';
  return null;
}
