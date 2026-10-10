import { useState } from 'react';
import type { FacultyKey, Society } from '../../types/events';
import {
  audienceFromDraft,
  draftFromAudience,
  isPartner,
  type AudienceDraft,
} from '../../utils/partnerAudience';
import type { PartnerMarks } from '../../store/slices/societies/saveSociety';

/**
 * The partner half of SocietyForm (spec 2026-10-09), kept out of it so the form
 * stays short: society or partner, the audience, and the two colour marks.
 */
export function usePartnerDraft(society?: Society) {
  const [kind, setKind] = useState<'society' | 'partner'>(
    isPartner(society) ? 'partner' : 'society'
  );
  const [draft, setDraft] = useState<AudienceDraft>(() => draftFromAudience(society?.audience));
  const [light, setLight] = useState<File | null>(null);
  const [dark, setDark] = useState<File | null>(null);

  /**
   * An i18n key under admin.societies, or null when the partner part may be
   * saved. `facultyKey` is the row's faculty, which released builds without
   * the audience rule fall back to, so it must be one of the audience's
   * faculties; whole-MENDELU there means everyone, which only a partner for
   * everyone may have.
   */
  const validate = (facultyKey?: FacultyKey): string | null => {
    if (kind === 'society') return null;
    const audience = audienceFromDraft(draft);
    if (audience === 'invalid') return 'errors.audience';
    const forEveryone = audience.includes('mendelu');
    const faculties = audience.map((token) => token.split(':')[0]);
    if (facultyKey && !forEveryone && !faculties.includes(facultyKey)) {
      return 'errors.partner_faculty';
    }
    if (!light && !society?.markLight) return 'errors.mark_required';
    return null;
  };
  const toInput = (): { kind: 'society' | 'partner'; audience: string[] | null } => {
    const audience = kind === 'partner' ? audienceFromDraft(draft) : null;
    return { kind, audience: audience === 'invalid' ? null : audience };
  };
  // Marks picked before switching back to Society are not a society's to save.
  const marks: PartnerMarks = kind === 'partner' ? { light, dark } : { light: null, dark: null };
  return {
    kind,
    setKind,
    draft,
    setDraft,
    light,
    setLight,
    dark,
    setDark,
    validate,
    toInput,
    marks,
  };
}
