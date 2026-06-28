import { Check, Star, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { socialFor } from '../../data/mockSocial';

// The social block of the event detail card: live going / interested counts and
// the student's own Going / Interested toggle. We have no real attendee faces
// (mock phase), so instead of faking avatars the counts stand on their own —
// honest and minimal. The displayed going number reflects the user's own RSVP
// (+1 when going) so tapping feels alive.
export function EventRsvp({ eventId, accent }: { eventId: string; accent: string }) {
  const status = useAppStore((s) => s.rsvp[eventId]);
  const setRsvp = useAppStore((s) => s.setRsvp);
  const { t } = useTranslation();

  const { going, interested } = socialFor(eventId);
  const goingTotal = going + (status === 'going' ? 1 : 0);
  const interestedTotal = interested + (status === 'interested' ? 1 : 0);

  return (
    <div className="space-y-2.5 pt-0.5">
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <Users size={16} className="flex-shrink-0 text-base-content/45" />
        <span><span className="font-bold text-base-content">{goingTotal}</span> {t('map.going')}</span>
        <span className="text-base-content/30">·</span>
        <span><span className="font-bold text-base-content">{interestedTotal}</span> {t('map.interested')}</span>
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
