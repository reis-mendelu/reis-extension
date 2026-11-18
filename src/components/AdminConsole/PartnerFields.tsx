import { useTranslation } from '../../hooks/useTranslation';
import { AudiencePicker } from './AudiencePicker';
import { MarkPreview } from './MarkPreview';
import type { usePartnerDraft } from './usePartnerDraft';

type PartnerDraft = ReturnType<typeof usePartnerDraft>;

export function PartnerFields({ state }: { state: PartnerDraft }) {
  const { t } = useTranslation();
  const { kind, setKind, draft, setDraft, light, setLight, dark, setDark } = state;
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
          <AudiencePicker
            draft={draft}
            setDraft={setDraft}
            legend={t('admin.societies.audience')}
          />
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
