import { Star, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { readableTextColor } from '../../utils/readableTextColor';

// The social block of the event detail card: how many have answered, and the
// student's own answer.
//
// ONE answer, not two. "Půjdu" and "Mám zájem" asked a student to grade their
// own intention before they had decided anything, and nothing downstream ever
// used the difference — the reminder fires for both, and the calendar block now
// follows both. So the card asks the one question it acts on.
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
  // Both columns, under one label: every row was written by someone who tapped
  // the one button this card used to have two of, and the older rows say
  // 'going' only because that was the wording at the time.
  const answeredTotal = (counts?.going ?? 0) + (counts?.interested ?? 0);
  // A legacy 'going' answer is still an answer. Tapping sends back whatever the
  // student is already holding, which is how setRsvp reads "un-answer me".
  const answered = status !== undefined;
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
          <span className="font-bold text-base-content">{answeredTotal}</span> {t('map.interested')}
        </span>
      </div>

      <button
        onClick={() => void setRsvp(eventId, status ?? 'interested')}
        aria-pressed={answered}
        className={`btn btn-sm w-full gap-1.5 ${answered ? '' : 'btn-soft'}`}
        style={answered ? activeStyle : undefined}
      >
        <Star size={14} /> {t('map.rsvpInterested')}
      </button>
    </div>
  );
}
