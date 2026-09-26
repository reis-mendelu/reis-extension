import { audienceHint, audienceLabelKey } from '../../utils/eventAudience';
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
 * It was two equal buttons ("Všichni" / the restricted option) under its own
 * heading — a question every society had to read on every event, answered
 * "everyone" by nearly all of them (1 of 6 prod events restricted, Sep 2026).
 * A checkbox keeps the choice one tap away without asking it.
 *
 * "Jen odběratelé" was the mechanism talking. A society thinks in terms of who
 * the event is FOR — its faculty's students, or the Erasmus crowd — so the
 * label says that instead, resolved per society by `audienceLabelKey`.
 */
export function ComposerAudienceField({ societyId, value, onChange }: ComposerAudienceFieldProps) {
  const { t } = useTranslation();
  // '' (no society) reads undefined, which is the generic wording.
  const society = useAppStore((s) => s.societies[societyId]);
  const audience = audienceLabelKey(society);
  const hint = audienceHint(society);

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
      {/* The label names the audience the society recognises; this line keeps
          the promise honest. The filter runs on SUBSCRIPTIONS — a faculty only
          seeds the default — so "students of PEF" is an approximation, and a
          society choosing who sees its event deserves to know by what. */}
      {value && (
        <p className="mt-1 pl-7 text-[11px] leading-snug text-base-content/70">
          {t(hint.key, hint.society ? { society: hint.society } : undefined)}
        </p>
      )}
    </div>
  );
}
