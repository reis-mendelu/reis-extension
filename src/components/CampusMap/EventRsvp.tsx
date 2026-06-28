import { Check, Star, User } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { socialFor } from '../../data/mockSocial';

// The social block of the event detail card: an overlapping avatar stack, the
// live going/interested counts, and the student's own Going / Interested toggle.
// Counts come from the deterministic mock layer (socialFor); the displayed going
// number reflects the user's own RSVP (+1 when going) so tapping feels alive.
export function EventRsvp({ eventId, accent }: { eventId: string; accent: string }) {
  const status = useAppStore((s) => s.rsvp[eventId]);
  const setRsvp = useAppStore((s) => s.setRsvp);
  const { t } = useTranslation();

  const { going, interested } = socialFor(eventId);
  const goingTotal = going + (status === 'going' ? 1 : 0);
  const interestedTotal = interested + (status === 'interested' ? 1 : 0);

  return (
    <div className="space-y-2.5 pt-0.5">
      <div className="flex items-center gap-2.5">
        {/* one anonymous attendee + a "+N" bubble for everyone else going */}
        <div className="flex items-end">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-base-100"
            style={{ backgroundColor: accent }}
          >
            <User size={15} className="text-white" fill="currentColor" />
          </span>
          {goingTotal > 1 && (
            <span className="-ml-2.5 flex h-6 items-center justify-center rounded-full bg-base-300 px-1.5 text-[10px] font-bold text-base-content ring-2 ring-base-100">
              +{goingTotal - 1}
            </span>
          )}
        </div>
        <span className="text-xs text-base-content/70">
          <span className="font-bold text-base-content">{goingTotal}</span> {t('map.going')}
          {' · '}
          <span className="font-bold text-base-content">{interestedTotal}</span> {t('map.interested')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setRsvp(eventId, 'going')}
          className={`btn btn-sm gap-1.5 ${status === 'going' ? 'text-white' : 'btn-soft'}`}
          style={status === 'going' ? { backgroundColor: accent, borderColor: accent } : undefined}
        >
          <Check size={14} /> {t('map.rsvpGoing')}
        </button>
        <button
          onClick={() => setRsvp(eventId, 'interested')}
          className={`btn btn-sm gap-1.5 ${status === 'interested' ? 'text-white' : 'btn-soft'}`}
          style={status === 'interested' ? { backgroundColor: accent, borderColor: accent } : undefined}
        >
          <Star size={14} /> {t('map.rsvpInterested')}
        </button>
      </div>
    </div>
  );
}
