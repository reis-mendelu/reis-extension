import { ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { useTranslation } from '../../hooks/useTranslation';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { parseEventDate } from './eventHelpers';
import { EventRsvp } from './EventRsvp';
import { FollowChip } from './FollowChip';
import { EventVenueLine } from './EventVenueLine';
import { eventDetailsLink } from './eventLinks';
import type { MapEvent } from '../../types/events';

// Bottom-left detail body for a selected event — a read-only preview shown to
// students and societies alike: a small society avatar + title + host, then the
// facts (when / what / where), the social block (attendance + RSVP), and More
// info. A society edits/deletes its own events from the "Moje akce" panel, so
// this card carries no authoring controls (keeps management in one place).
/**
 * `flush` drops the card's own frame.
 *
 * Inside the tablet rail the frame is a box drawn inside a box: the rail is
 * already a bordered, rounded panel, and a second one 16px in is the classic
 * nested-card look that stops a sidebar reading as native. The desktop's
 * floating DetailPanel and the phone's sheet both still want it — there the
 * card IS the surface.
 */
export function EventDetailCard({ event, flush = false }: { event: MapEvent; flush?: boolean }) {
  const { t, language } = useTranslation();
  // A non-empty id always resolves: unknown ids get the neutral society.
  const soc = useSociety(event.societyId)!;
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  // A multi-day event (a trip) shows its whole span, so the card never reads as
  // a one-evening event; formatRange keeps it one locale-ordered line
  // ("po 23. 11. – ne 29. 11.", "Mon, November 23 – Sun, November 29"). `>`
  // rather than `!==`: older engines throw on a reversed range.
  const dateFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const start = parseEventDate(event.date);
  const dateLabel =
    event.endDate && event.endDate > event.date
      ? dateFormat.formatRange(start, parseEventDate(event.endDate))
      : dateFormat.format(start);
  const details = eventDetailsLink(event, soc);

  return (
    <div className={flush ? '' : 'overflow-hidden rounded-lg border border-base-300 bg-base-100'}>
      <div className="space-y-3 p-3">
        {/* identity: avatar + title + host */}
        <div className="flex items-center gap-3">
          <SocietyLogo
            society={soc}
            className="h-11 w-11 rounded-full ring-1 ring-base-300 text-sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">
              {event.title}
            </h3>
            {/* the chip lives on the host line, not squeezed onto the title,
                so it never pushes the title into wrapping at 320px */}
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-xs text-base-content/60">
                {t('map.hostedBy')} {soc.shortName}
              </span>
              <FollowChip societyId={event.societyId} />
            </div>
          </div>
        </div>

        {/* The society's own words, when it wrote any. pre-line keeps the
            line breaks it typed without letting them widen the card. */}
        {event.description && (
          <p className="whitespace-pre-line break-words text-sm text-base-content/80">
            {event.description}
          </p>
        )}

        {/* the facts */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <Clock size={13} className="shrink-0" />
            <span>
              {dateLabel}
              {event.time ? ` · ${event.time}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <img src={CATEGORY_EMOJI_SRC[event.category]} alt="" className="h-4 w-4 shrink-0" />
            <span>{t(`map.category.${event.category}`)}</span>
          </div>
          <EventVenueLine event={event} societyShortName={soc.shortName} />
        </div>

        <div className="border-t border-base-300 pt-3">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {details && (
          <a
            href={details.href}
            target="_blank"
            rel="noopener noreferrer"
            // No onClick of its own: on Capacitor installExternalLinkHandler
            // (capture phase) already opens every target=_blank link in the
            // in-app browser, and a second open here showed the page twice.
            className="btn btn-primary btn-sm btn-block"
          >
            {details.kind === 'instagram' ? t('map.moreOnInstagram') : t('map.moreInfo')}{' '}
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
