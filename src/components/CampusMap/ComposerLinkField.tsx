const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

// The optional event URL. Split out of EventComposer.tsx to keep it under its
// line budget, not because this field has any logic of its own.
export function ComposerLinkField({
  url,
  onChange,
  urlInvalid,
  t,
}: {
  url: string;
  onChange: (v: string) => void;
  urlInvalid: boolean;
  t: (k: string) => string;
}) {
  return (
    <>
      {/* `flex flex-col`, not DaisyUI 4's dead `form-control`: an inline label
          let the 20rem input ride up over its text at iPad width. */}
      <label className="flex w-full flex-col">
        <span className={LABEL}>{t('admin.urlLabel')}</span>
        <input
          className="input input-bordered input-sm w-full"
          placeholder={t('admin.urlHint')}
          value={url}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {urlInvalid && <p className="mt-1 text-[11px] text-error">{t('admin.urlInvalid')}</p>}
    </>
  );
}
