import type { PostKind } from '../../types/events';

const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

/**
 * The post's name and, for an event, its description. A notice is not asked
 * for one: Novinky shows a notice's title and opens its link, and nothing
 * shows its body, so the field would collect text no student ever reads.
 * Split out of EventComposer.tsx to keep it under its line budget.
 */
export function ComposerTextFields({
  kind,
  title,
  description,
  onTitle,
  onDescription,
  t,
}: {
  kind: PostKind;
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  t: (k: string) => string;
}) {
  const name = t(kind === 'notice' ? 'map.noticeName' : 'map.eventName');
  return (
    <>
      <label className={LABEL}>{name}</label>
      <input
        className="input input-bordered w-full"
        placeholder={name}
        value={title}
        onChange={(e) => onTitle(e.target.value)}
      />
      {kind === 'event' && (
        <label className="flex w-full flex-col">
          <span className={LABEL}>{t('map.description')}</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            placeholder={t('map.descriptionHint')}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
          />
        </label>
      )}
    </>
  );
}
