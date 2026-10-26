import type { VenueGroup } from './eventHelpers';
import { parseEventDate } from './eventHelpers';
import { CATEGORY_COLOR } from '../../data/eventCategories';
import { eventEmojiSrc } from '../../data/eventEmoji';

interface EventPinProps {
  group: VenueGroup;
  x: number; // centre screen x (container px) = exact coordinate
  y: number; // centre screen y
  selected: boolean;
  /** Floor view: the event's room is on a floor other than the one shown. */
  otherFloor?: boolean;
  floorLevel?: number | null;
  /** "3. floor", worded for the title and bubble: the badge alone is just a numeral. */
  floorLabel?: string;
  locale: string;
  onSelect: (id: string) => void;
}

// Exactly the Google-Maps place marker: a white circle with a lean light border
// and a soft lift shadow, carrying ONE real full-colour emoji (a bundled Twemoji
// SVG). The colour comes from the emoji itself, not a tint or coloured disc — and
// there is NO society ring/outline (society shows in the side list + hover bubble
// instead). No tail; the circle centres on the venue. No badges or always-on
// label; the count/title only surface on hover. (x, y) is a Leaflet LAYER point:
// the button centres there, and `leaflet-zoom-animated` lets that transform
// transition with the basemap during a zoom.
export function EventPin({
  group,
  x,
  y,
  selected,
  otherFloor = false,
  floorLevel = null,
  floorLabel,
  locale,
  onSelect,
}: EventPinProps) {
  const lead = group.events[0];
  const count = group.events.length;
  const emojiSrc = eventEmojiSrc(lead);
  const color = CATEGORY_COLOR[lead.category];
  const dateLabel = parseEventDate(lead.date).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <button
      type="button"
      className="group pointer-events-auto absolute left-0 top-0 flex items-center justify-center leaflet-zoom-animated"
      style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
      title={floorLabel ? `${lead.title} · ${floorLabel}` : lead.title}
      aria-label={floorLabel ? `${lead.title} · ${floorLabel}` : undefined}
      data-other-floor={otherFloor ? 'true' : undefined}
      onClick={() => onSelect(lead.id)}
    >
      {/* White circle, lean border + lift shadow, real colour emoji inside. */}
      <span
        className="relative flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110"
        style={{
          width: 30,
          height: 30,
          // A pin for a room on another floor is the same event, held back: it is
          // not where the plan under it says it is, and the badge says which floor.
          opacity: otherFloor ? 0.55 : 1,
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: selected
            ? `0 0 0 2px ${color}, 0 1px 5px rgba(0,0,0,.3)`
            : '0 1px 4px rgba(0,0,0,.28)',
        }}
      >
        <img src={emojiSrc} alt="" width={18} height={18} draggable={false} />
        {otherFloor && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral px-1 text-[9px] font-bold leading-none text-neutral-content"
          >
            {floorLevel ?? '?'}
          </span>
        )}

        {/* Sneak-peek bubble on hover (above the circle): title, date, "+N more". */}
        <span className="pointer-events-none absolute bottom-[40px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-left text-base-content shadow-popover-heavy group-hover:block">
          <span className="block text-[11px] font-bold leading-tight">{lead.title}</span>
          <span className="block text-[10px] font-semibold leading-tight" style={{ color }}>
            {dateLabel}
            {lead.time ? ` · ${lead.time}` : ''}
            {count > 1 ? ` · +${count - 1}` : ''}
          </span>
          {floorLabel && (
            <span className="block text-[10px] font-semibold leading-tight text-base-content/70">
              {floorLabel}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
