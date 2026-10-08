import { audienceLabelKey } from '../../utils/eventAudience';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

export interface ComposerAudienceFieldProps {
  /** The society authoring this event — what the restricted option is named after. */
  societyId: string;
  value: boolean;
  onChange: (subscribersOnly: boolean) => void;
}

/**
 * Who the event is for, as one opt-in: "Jen studenti PEF", off by default.
 *
 * A checkbox rather than two equal buttons: nearly every event is for everyone,
 * so the choice stays one tap away without being asked every time.
 *
 * The label names exactly who sees the event — the society's faculty, or the
 * Erasmus students for ESN — because that is the rule (`utils/eventAudience`),
 * not an approximation of a follow list. reIS is university-wide and has no
 * narrower audience, so it gets no control at all.
 */
export function ComposerAudienceField({ societyId, value, onChange }: ComposerAudienceFieldProps) {
  const { t } = useTranslation();
  // '' (no society) reads undefined, which cannot restrict.
  const society = useAppStore((s) => s.societies[societyId]);
  const audience = audienceLabelKey(society);
  if (!audience) return null;

  return (
    <div className="mt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{t(audience.key, audience.faculty ? { faculty: audience.faculty } : undefined)}</span>
      </label>
      {value && (
        <p className="mt-1 pl-7 text-[11px] leading-snug text-base-content/70">
          {t('map.audienceHint')}
        </p>
      )}
    </div>
  );
}
