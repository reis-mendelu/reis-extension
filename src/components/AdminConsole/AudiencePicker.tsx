import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type FacultyKey } from '../../types/events';
import type { AudienceDraft } from '../../utils/partnerAudience';

const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

/**
 * Who a thing is shown to, as the console edits it: a checkbox per faculty, and
 * under a ticked faculty a free list of programme codes (empty = the whole
 * faculty). The draft is `AudienceDraft`; `audienceFromDraft` turns it into the
 * tokens (`af:B-ATE`) that `matchesAudience` reads on the student's device.
 * Shared by a partner's form and the study-aids links.
 */
export function AudiencePicker({
  draft,
  setDraft,
  legend,
}: {
  draft: AudienceDraft;
  setDraft: Dispatch<SetStateAction<AudienceDraft>>;
  legend: string;
}) {
  const { t, language } = useTranslation();
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

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 opacity-70">{legend}</legend>
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
  );
}
