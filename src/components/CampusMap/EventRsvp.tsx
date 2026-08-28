import { Check, Star, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { readableTextColor } from '../../utils/readableTextColor';

// The social block of the event detail card: going / interested counts and the
// student's own toggle.
//
// The counts used to come from `socialFor()`, which hashed the event id into a
// plausible-looking pair — so an event nobody had answered told every student
// "108 zájemců". They now come from the `event_rsvps` table through the store,
// which also owns the optimistic +1 and its rollback, so this component just
// renders what it is told. No attendee faces: the counts stand on their own.
export function EventRsvp({ eventId, accent }: { eventId: string; accent: string }) {
  const status = useAppStore((s) => s.rsvp[eventId]);
  const counts = useAppStore((s) => s.rsvpCounts[eventId]);
  const setRsvp = useAppStore((s) => s.setRsvp);
  const { t } = useTranslation();

  // Zero until the counts load, never a placeholder: an unknown number and an
  // invented one look identical on a card, which is how the mock survived.
  const goingTotal = counts?.going ?? 0;
  const interestedTotal = counts?.interested ?? 0;
  // active fill = society colour; foreground picked for contrast (white fails on
  // light brand colours like ESN cyan).
  const activeStyle = {
    backgroundColor: accent,
    borderColor: accent,
    color: readableTextColor(accent),
  };

  return (
    <div className="space-y-2.5 pt-0.5">
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <Users size={16} className="flex-shrink-0 text-base-content/45" />
        <span>
          <span className="font-bold text-base-content">{goingTotal}</span> {t('map.going')}
        </span>
        <span className="text-base-content/30">·</span>
        <span>
          <span className="font-bold text-base-content">{interestedTotal}</span>{' '}
          {t('map.interested')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => void setRsvp(eventId, 'going')}
          className={`btn btn-sm gap-1.5 ${status === 'going' ? '' : 'btn-soft'}`}
          style={status === 'going' ? activeStyle : undefined}
        >
          <Check size={14} /> {t('map.rsvpGoing')}
        </button>
        <button
          onClick={() => void setRsvp(eventId, 'interested')}
          className={`btn btn-sm gap-1.5 ${status === 'interested' ? '' : 'btn-soft'}`}
          style={status === 'interested' ? activeStyle : undefined}
        >
          <Star size={14} /> {t('map.rsvpInterested')}
        </button>
      </div>
    </div>
  );
}
