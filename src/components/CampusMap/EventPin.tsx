import type { VenueGroup } from './eventHelpers';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';

interface EventPinProps {
  group: VenueGroup;
  x: number; // anchor screen x (container px)
  y: number; // anchor screen y
  selected: boolean;
  locale: string;
  onSelect: (id: string) => void;
}

// A balloon floats up-left of the anchor dot, tethered by a curved "rope" so it
// reads as tied to its exact spot without covering the building. The soonest
// event supplies the society colour/glyph; a badge counts the rest.
export function EventPin({ group, x, y, selected, locale, onSelect }: EventPinProps) {
  const lead = group.events[0];
  const soc = societyById(lead.societyId);
  const count = group.events.length;
  const dateLabel = parseEventDate(lead.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      {/* Rope: from the anchor (local 50,72) curving up to the balloon (20,10). */}
      <svg
        className="pointer-events-none absolute"
        width="64" height="80" style={{ left: -50, top: -72, overflow: 'visible' }}
      >
        <path d="M50 72 Q 26 58 20 12" fill="none" stroke={soc.color} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      </svg>

      {/* Anchor dot at the exact coordinate. */}
      <span
        className="absolute rounded-full ring-2 ring-white"
        style={{ left: 0, top: 0, width: 8, height: 8, transform: 'translate(-50%, -50%)', backgroundColor: soc.color }}
      />

      {/* Floating balloon. `group` enables the hover sneak-peek. */}
      <button
        className="group pointer-events-auto absolute flex items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition-transform hover:scale-110"
        style={{
          left: -30, top: -62, width: 38, height: 38,
          transform: 'translate(-50%, -50%)',
          backgroundColor: soc.color,
          boxShadow: selected ? `0 0 0 4px ${soc.color}55, 0 2px 8px rgba(0,0,0,.4)` : undefined,
        }}
        title={lead.title}
        onClick={() => onSelect(lead.id)}
      >
        {lead.imageUrl || soc.logo
          ? <img src={lead.imageUrl ?? soc.logo} alt="" className="h-full w-full rounded-full object-cover" />
          : <span className="text-xs font-extrabold leading-none">{soc.glyph}</span>}
        {count > 1 && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-base-content ring-1 ring-base-300"
          >
            {count}
          </span>
        )}
        {/* Sneak-peek bubble on hover. */}
        <span
          className="pointer-events-none absolute bottom-[46px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-left text-base-content shadow-popover-heavy group-hover:block"
        >
          <span className="block text-[11px] font-bold leading-tight">{lead.title}</span>
          <span className="block text-[10px] font-semibold leading-tight" style={{ color: soc.color }}>
            {dateLabel}{lead.time ? ` · ${lead.time}` : ''}{count > 1 ? ` · +${count - 1}` : ''}
          </span>
        </span>
      </button>
    </div>
  );
}
