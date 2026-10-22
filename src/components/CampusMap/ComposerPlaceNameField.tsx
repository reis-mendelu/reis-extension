const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

// The name a pin goes by on the card, for a place the search cannot find. The
// coordinate is what opens Maps; this only decides what it is called.
export function ComposerPlaceNameField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <label className="flex w-full flex-col">
      <span className={LABEL}>{t('map.placeName')}</span>
      <input
        className="input input-bordered input-sm w-full"
        placeholder={t('map.placeNameHint')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
