import { ExternalLink, CalendarDays, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { parseEventDate } from './eventHelpers';
import { EventVenueLine } from './EventVenueLine';
import { EventFactChip } from './EventFactChip';
import { eventDetailsLink } from './eventLinks';
import type { MapEvent } from '../../types/events';

// Bottom-left detail body for a selected event — a read-only preview shown to
// students and societies alike: a small society avatar + title + host, then the
// facts (when / where) and More info. Nothing social: no follow, no
// RSVP, no count (spec 2026-10-08 — an event to go to, shown quietly). A society edits/deletes its own events from the "Moje akce" panel, so
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
export function EventDetailCard({
  event,
  flush = false,
  onClose,
  closeLabel,
}: {
  event: MapEvent;
  flush?: boolean;
  /** A card that floats over a picture closes itself: the button sits beside the title, never on top of it. */
  onClose?: () => void;
  closeLabel?: string;
}) {
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
      <div className="space-y-4 p-4">
        {/* identity: avatar + title + host */}
        <div className="flex items-center gap-3">
          <SocietyLogo
            society={soc}
            className="h-12 w-12 rounded-full ring-1 ring-base-300 text-base"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-base-content">
              {event.title}
            </h3>
            <span className="block min-w-0 truncate text-xs text-base-content/60">
              {t('map.hostedBy')} {soc.shortName}
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="btn btn-circle btn-ghost btn-sm shrink-0 self-start"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* the facts a student plans around: when, then where */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-sm text-base-content">
            <EventFactChip>
              <CalendarDays size={14} />
            </EventFactChip>
            <span>
              <span className="font-medium">{dateLabel}</span>
              {event.time ? (
                <span className="text-base-content/70">{` · ${event.time}`}</span>
              ) : null}
            </span>
          </div>
          <EventVenueLine event={event} />
        </div>

        {/* The society's own words, when it wrote any. pre-line keeps the
            line breaks it typed without letting them widen the card. */}
        {event.description && (
          <p className="whitespace-pre-line break-words border-t border-base-300 pt-3 text-sm leading-relaxed text-base-content/80">
            {event.description}
          </p>
        )}

        {details && (
          <a
            href={details.href}
            target="_blank"
            rel="noopener noreferrer"
            // No onClick of its own: on Capacitor installExternalLinkHandler
            // (capture phase) already opens every target=_blank link in the
            // in-app browser, and a second open here showed the page twice.
            className="btn btn-primary btn-block"
          >
            {details.kind === 'instagram' ? t('map.moreOnInstagram') : t('map.moreInfo')}{' '}
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
