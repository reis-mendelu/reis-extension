import type { VenueGroup } from './eventHelpers';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';
import { CATEGORY_ICON } from '../../data/eventCategories';

interface EventPinProps {
  group: VenueGroup;
  x: number; // tip screen x (container px) = exact coordinate
  y: number; // tip screen y
  selected: boolean;
  locale: string;
  onSelect: (id: string) => void;
}

// A society-coloured teardrop whose pointed tip sits on the exact spot — no rope,
// no floating. The round head carries the society logo; a white badge (top-right)
// shows the soonest event's type icon; a count badge (bottom-right) appears only
// when several events share the venue. Wrapper is translated so its bottom tip
// lands at (x, y).
export function EventPin({ group, x, y, selected, locale, onSelect }: EventPinProps) {
  const lead = group.events[0];
  const soc = societyById(lead.societyId);
  const count = group.events.length;
  const Icon = CATEGORY_ICON[lead.category];
  const dateLabel = parseEventDate(lead.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <button
      className="group pointer-events-auto absolute flex flex-col items-center"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
      title={lead.title}
      onClick={() => onSelect(lead.id)}
    >
      {/* Head: society colour + logo, with badges. */}
      <span
        className="relative flex items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-110"
        style={{
          width: 38, height: 38, backgroundColor: soc.color,
          boxShadow: selected ? `0 0 0 4px ${soc.color}55, 0 2px 8px rgba(0,0,0,.4)` : undefined,
        }}
      >
        {lead.imageUrl || soc.logo
          ? <img src={lead.imageUrl ?? soc.logo} alt="" className="h-full w-full rounded-full object-cover" />
          : <span className="text-xs font-extrabold leading-none">{soc.glyph}</span>}

        {/* Type badge (top-right). */}
        <span
          className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-white ring-1 ring-black/10"
          style={{ width: 18, height: 18 }}
        >
          <Icon size={11} color={soc.color} strokeWidth={2.5} />
        </span>

        {/* Count badge (bottom-right) — only when co-located. */}
        {count > 1 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-slate-800 ring-1 ring-black/10"
          >
            {count}
          </span>
        )}

        {/* Sneak-peek bubble on hover (above the head). */}
        <span
          className="pointer-events-none absolute bottom-[46px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-left text-base-content shadow-popover-heavy group-hover:block"
        >
          <span className="block text-[11px] font-bold leading-tight">{lead.title}</span>
          <span className="block text-[10px] font-semibold leading-tight" style={{ color: soc.color }}>
            {dateLabel}{lead.time ? ` · ${lead.time}` : ''}{count > 1 ? ` · +${count - 1}` : ''}
          </span>
        </span>
      </span>

      {/* Pointer: solid society-colour triangle; its bottom point is the tip. */}
      <span
        style={{
          width: 0, height: 0, marginTop: -1,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          borderTop: `8px solid ${soc.color}`,
        }}
      />
    </button>
  );
}
