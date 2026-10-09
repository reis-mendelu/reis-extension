import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type FacultyKey } from '../../types/events';
import { MarkPreview } from './MarkPreview';
import type { usePartnerDraft } from './usePartnerDraft';

const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

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
      {/* Native radios (DaisyUI's radio-as-button pattern), so arrow keys and
          the single tab stop work as a radio group should. */}
      <div role="radiogroup" aria-label={t('admin.societies.kind')} className="join">
        {(['society', 'partner'] as const).map((k) => (
          <input
            key={k}
            type="radio"
            name="society-kind"
            className="btn btn-sm join-item checked:btn-primary"
            aria-label={t(
              k === 'society' ? 'admin.societies.kindSociety' : 'admin.societies.kindPartner'
            )}
            checked={kind === k}
            onChange={() => setKind(k)}
          />
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
            <span className="text-xs text-base-content/70">
              {t('admin.societies.audienceHint')}
            </span>
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
