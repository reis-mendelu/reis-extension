import { Globe } from 'lucide-react';
import { audienceHint, audienceLabelKey } from '../../utils/eventAudience';
import { useTranslation } from '../../hooks/useTranslation';

export interface ComposerAudienceFieldProps {
  /** The society authoring this event — what the restricted option is named after. */
  societyId: string;
  value: boolean;
  onChange: (subscribersOnly: boolean) => void;
}

/**
 * Who the event is for: everyone's map, or only the maps of the students who
 * follow this society.
 *
 * A field of the composer, split out for the same reason as ComposerTimeField
 * and ComposerRoomSearch beside it — the composer is a long form and each
 * question it asks is its own cohesive thing.
 *
 * "Jen odběratelé" was the mechanism talking. A society thinks in terms of who
 * the event is FOR — its faculty's students, or the Erasmus crowd — so the
 * button says that instead, resolved per society by `audienceLabelKey`.
 */
export function ComposerAudienceField({ societyId, value, onChange }: ComposerAudienceFieldProps) {
  const { t } = useTranslation();
  const audience = audienceLabelKey(societyId);
  const hint = audienceHint(societyId);

  return (
    <>
      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.audienceLabel')}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn btn-sm flex-1 gap-1 ${!value ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
          onClick={() => onChange(false)}
        >
          <Globe size={13} /> {t('map.audienceEveryone')}
        </button>
        <button
          type="button"
          className={`btn btn-sm flex-1 gap-1 ${value ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
          onClick={() => onChange(true)}
        >
          {t(audience.key, audience.faculty ? { faculty: audience.faculty } : undefined)}
        </button>
      </div>
      {/* The button names the audience the society recognises; this line keeps
          the promise honest. The filter runs on SUBSCRIPTIONS — a faculty only
          seeds the default — so "students of PEF" is an approximation, and a
          society choosing who sees its event deserves to know by what. */}
      {value && (
        <p className="mt-1 text-[11px] leading-snug text-base-content/70">
          {t(hint.key, hint.society ? { society: hint.society } : undefined)}
        </p>
      )}
    </>
  );
}
