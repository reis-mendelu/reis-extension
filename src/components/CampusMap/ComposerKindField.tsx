import type { PostKind } from '../../types/events';

const LABEL = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

const KINDS: ReadonlyArray<{ kind: PostKind; label: string }> = [
  { kind: 'event', label: 'map.kindEvent' },
  { kind: 'notice', label: 'map.kindNotice' },
];

/**
 * Event or notice, asked first because it decides which fields follow: a
 * notice ("Hledáš bydlení v Brně?") is an announcement, shown in Novinky only,
 * so it has no place and no pin. Two equal buttons, not a checkbox: neither is
 * a deviation from the other, and the society should see both words.
 */
export function ComposerKindField({
  value,
  onChange,
  t,
}: {
  value: PostKind;
  onChange: (kind: PostKind) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="mb-1">
      <span className={LABEL}>{t('map.kindLabel')}</span>
      <div className="join w-full" role="group" aria-label={t('map.kindLabel')}>
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={value === kind}
            className={`btn join-item btn-sm flex-1 ${value === kind ? 'btn-primary' : 'btn-ghost bg-base-100'}`}
            onClick={() => onChange(kind)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-base-content/70">
        {t(value === 'notice' ? 'map.kindNoticeHint' : 'map.kindEventHint')}
      </p>
    </div>
  );
}
