import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type FacultyKey, type Society } from '../../types/events';
import {
  audienceFromDraft,
  draftFromAudience,
  isPartner,
  type AudienceDraft,
} from '../../utils/partnerAudience';
import type { PartnerMarks } from '../../store/slices/societies/saveSociety';
import { MarkPreview } from './MarkPreview';

const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

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
  return { kind, setKind, draft, setDraft, light, setLight, dark, setDark, validate, toInput, marks };
}

type PartnerDraft = ReturnType<typeof usePartnerDraft>;

export function PartnerFields({ state }: { state: PartnerDraft }) {
  const { t, language } = useTranslation();
  const { kind, setKind, draft, setDraft, light, setLight, dark, setDark } = state;
  const facultyName = (k: FacultyKey) =>
    k === 'mendelu'
      ? t('admin.societies.wholeMendelu')
      : ORGANIZERS[k][language === 'en' ? 'en' : 'cz'];
  const toggle = (k: FacultyKey) =>
    setDraft((d) => {
      const next = { ...d };
      if (k in next) delete next[k];
      else next[k] = '';
      return next;
    });
  const fileInput = 'file-input file-input-bordered file-input-sm w-full';

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t('admin.societies.kind')} className="join">
        {(['society', 'partner'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`btn btn-sm join-item ${kind === k ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setKind(k)}
          >
            {t(k === 'society' ? 'admin.societies.kindSociety' : 'admin.societies.kindPartner')}
          </button>
        ))}
      </div>
      {kind === 'partner' && (
        <>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 opacity-70">{t('admin.societies.audience')}</legend>
            {FACULTIES.map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={k in draft}
                    onChange={() => toggle(k)}
                  />
                  {facultyName(k)}
                </label>
                {k in draft && k !== 'mendelu' && (
                  <input
                    className="input input-bordered input-sm ml-6"
                    aria-label={`${facultyName(k)}: ${t('admin.societies.programmesPlaceholder')}`}
                    placeholder={t('admin.societies.programmesPlaceholder')}
                    value={draft[k] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <span className="text-xs text-base-content/70">{t('admin.societies.audienceHint')}</span>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">{t('admin.societies.markLight')}</span>
            <input
              type="file"
              accept="image/png,image/webp"
              className={fileInput}
              onChange={(e) => setLight(e.target.files?.[0] ?? null)}
            />
          </label>
          {light && (
            <div data-theme="mendelu" className="self-start rounded-lg bg-base-100 p-2">
              <MarkPreview file={light} />
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">{t('admin.societies.markDark')}</span>
            <input
              type="file"
              accept="image/png,image/webp"
              className={fileInput}
              onChange={(e) => setDark(e.target.files?.[0] ?? null)}
            />
          </label>
          {dark && (
            <div data-theme="mendelu-dark" className="self-start rounded-lg bg-base-100 p-2">
              <MarkPreview file={dark} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
