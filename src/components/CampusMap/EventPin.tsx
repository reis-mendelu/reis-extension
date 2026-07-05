import type { VenueGroup } from './eventHelpers';
import { parseEventDate } from './eventHelpers';
import { CATEGORY_EMOJI_SRC, CATEGORY_COLOR } from '../../data/eventCategories';

interface EventPinProps {
  group: VenueGroup;
  x: number; // centre screen x (container px) = exact coordinate
  y: number; // centre screen y
  selected: boolean;
  // A society's own far-future event, only ever true in Society mode — rendered
  // faded/dashed so the society can tell it's not yet visible to students.
  scheduled?: boolean;
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
  scheduled = false,
  locale,
  onSelect,
}: EventPinProps) {
  const lead = group.events[0];
  const count = group.events.length;
  const emojiSrc = CATEGORY_EMOJI_SRC[lead.category];
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
      title={lead.title}
      onClick={() => onSelect(lead.id)}
    >
      {/* White circle, lean border + lift shadow, real colour emoji inside. */}
      <span
        data-scheduled={scheduled}
        className="relative flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110"
        style={{
          width: 30,
          height: 30,
          opacity: scheduled ? 0.65 : 1,
          border: scheduled ? '1.5px dashed rgba(0,0,0,0.3)' : '1px solid rgba(0,0,0,0.12)',
          boxShadow: selected
            ? `0 0 0 2px ${color}, 0 1px 5px rgba(0,0,0,.3)`
            : '0 1px 4px rgba(0,0,0,.28)',
        }}
      >
        <img src={emojiSrc} alt="" width={18} height={18} draggable={false} />

        {/* Sneak-peek bubble on hover (above the circle): title, date, "+N more". */}
        <span className="pointer-events-none absolute bottom-[40px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-left text-base-content shadow-popover-heavy group-hover:block">
          <span className="block text-[11px] font-bold leading-tight">{lead.title}</span>
          <span className="block text-[10px] font-semibold leading-tight" style={{ color }}>
            {dateLabel}
            {lead.time ? ` · ${lead.time}` : ''}
            {count > 1 ? ` · +${count - 1}` : ''}
          </span>
        </span>
      </span>
    </button>
  );
}
