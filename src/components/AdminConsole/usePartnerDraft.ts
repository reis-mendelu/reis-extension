import { useState } from 'react';
import type { Society } from '../../types/events';
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

  /** An i18n key under admin.societies, or null when the partner part may be saved. */
  const validate = (): string | null => {
    if (kind === 'society') return null;
    if (audienceFromDraft(draft) === 'invalid') return 'errors.audience';
    if (!light && !society?.markLight) return 'errors.mark_required';
    return null;
  };
  const toInput = (): { kind: 'society' | 'partner'; audience: string[] | null } => {
    const audience = kind === 'partner' ? audienceFromDraft(draft) : null;
    return { kind, audience: audience === 'invalid' ? null : audience };
  };
  const marks: PartnerMarks = { light, dark };
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
