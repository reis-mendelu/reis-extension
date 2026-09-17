import { Star, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { readableTextColor } from '../../utils/readableTextColor';

// The social block of the event detail card: how many students are interested,
// and this student's own answer.
//
// The count used to come from `socialFor()`, which hashed the event id into a
// plausible-looking pair — so an event nobody had answered told every student
// "108 zájemců". It now comes from the `event_rsvps` table through the store,
// which also owns the optimistic +1 and its rollback, so this component just
// renders what it is told. No attendee faces: the count stands on its own.
//
// There were two buttons here, Půjdu and Mám zájem. One answer is enough, and
// two were actively worse: the same turnout was split across two numbers that
// each read smaller than the room, and a student had to decide how committed
// they felt before they could know. `going` still exists in the table, the RPC
// and `RsvpStatus` — rows written before this change still hold it — but
// nothing in the app writes it any more, so the card shows the one count it can
// still move rather than a "0 půjde" that can never change.
export function EventRsvp({ eventId, accent }: { eventId: string; accent: string }) {
  const status = useAppStore((s) => s.rsvp[eventId]);
  const counts = useAppStore((s) => s.rsvpCounts[eventId]);
  const setRsvp = useAppStore((s) => s.setRsvp);
  const { t } = useTranslation();

  // Zero until the counts load, never a placeholder: an unknown number and an
  // invented one look identical on a card, which is how the mock survived.
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
          <span className="font-bold text-base-content">{interestedTotal}</span>{' '}
          {t('map.interested')}
        </span>
      </div>

      <button
        onClick={() => void setRsvp(eventId, 'interested')}
        className={`btn btn-sm w-full gap-1.5 ${status === 'interested' ? '' : 'btn-soft'}`}
        style={status === 'interested' ? activeStyle : undefined}
      >
        <Star size={14} /> {t('map.rsvpInterested')}
      </button>
    </div>
  );
}
