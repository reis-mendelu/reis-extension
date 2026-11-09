import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { useEventPinPlacement } from './useEventPinPlacement';
import { useTranslation } from '../../hooks/useTranslation';
import { venueStatus } from '../../utils/venues/venueStatus';
import type { SocietyPin } from '../../types/campusMap';

/**
 * Society pins (`map_pins`) and venues (`venues`) on the campus overview: the
 * society's logo in a white ring, opening `SocietyPinCard`. A venue's pin is
 * the same size, ringed in the society's colour (grey while it is closed) and named
 * underneath, because it is a place to walk to, not a notice. Their own layer over the events' pane
 * and placement, not EventLayer's groups, so a pin is never grouped with,
 * counted as or listed among the events. Not drawn over a floor plan.
 */
export function SocietyPinLayer() {
  const pins = useAppStore((s) => s.societyPins);
  const venues = useAppStore((s) => s.venuePins);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const select = useAppStore((s) => s.selectSocietyPin);
  const items = useMemo(
    () =>
      activeBuildingId === null
        ? [...venues, ...pins].map((pin) => ({ key: pin.id, coord: pin.coord, pin }))
        : [],
    [venues, pins, activeBuildingId]
  );
  const { placed, pane } = useEventPinPlacement(items, null);
  const live = new Map(items.map((i) => [i.key, i]));
  const visible = placed.filter((p) => live.has(p.key));
  if (!pane || visible.length === 0) return null;
  const selectedId = selection?.kind === 'societyPin' ? selection.pin.id : null;

  return createPortal(
    <>
      {visible.map((p) => (
        <SocietyPinButton
          key={p.key}
          pin={live.get(p.key)!.pin}
          x={p.x}
          y={p.y}
          selected={p.key === selectedId}
          onSelect={select}
        />
      ))}
    </>,
    pane
  );
}

function SocietyPinButton({
  pin,
  x,
  y,
  selected,
  onSelect,
}: {
  pin: SocietyPin;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (pin: SocietyPin) => void;
}) {
  // A non-empty id always resolves: unknown ids get the neutral society.
  const soc = useSociety(pin.societyId)!;
  const { t } = useTranslation();
  const now = useAppStore((s) => s.now);
  if (pin.venue) {
    const open = venueStatus(pin.venue.hours, now, pin.venue.closure).open;
    const ring = open ? soc.color : '#9ca3af';
    return (
      <button
        type="button"
        data-testid="society-pin"
        data-venue-open={open}
        className="group pointer-events-auto absolute left-0 top-0 leaflet-zoom-animated"
        style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
        aria-label={open ? pin.title : `${pin.title} · ${t('map.venueClosedShort')}`}
        onClick={() => onSelect(pin)}
      >
        {/* The same footprint as a society pin (32px logo in a white ring);
            only the coloured ring and the name below set it apart. */}
        <span
          className="block rounded-full bg-white p-0.5 transition-transform group-hover:scale-110"
          style={{
            boxShadow: `0 0 0 2px ${ring}, 0 1px ${selected ? 6 : 4}px rgba(0,0,0,${selected ? 0.4 : 0.28})`,
          }}
        >
          <SocietyLogo
            society={soc}
            fit="contain"
            className={`h-8 w-8 rounded-full bg-white text-xs ${open ? '' : 'opacity-60'}`}
          />
        </span>
        {/* The basemap is light in both themes, so the label carries its own
            white surface and dark ink rather than the theme's — inline, as
            the search bar's surface is, since no theme token means "ink on
            the basemap". */}
        <span
          className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-1.5 py-px text-[10px] font-bold shadow"
          style={{ color: '#111827' }}
        >
          {open ? pin.title : `${pin.title} · ${t('map.venueClosedShort')}`}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid="society-pin"
      className="group pointer-events-auto absolute left-0 top-0 leaflet-zoom-animated"
      style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
      title={pin.title}
      aria-label={pin.title}
      onClick={() => onSelect(pin)}
    >
      <span
        className="block rounded-full bg-white p-0.5 transition-transform group-hover:scale-110"
        style={{
          boxShadow: selected
            ? `0 0 0 2px ${soc.color}, 0 1px 5px rgba(0,0,0,.3)`
            : '0 1px 4px rgba(0,0,0,.28)',
        }}
      >
        <SocietyLogo society={soc} className="h-8 w-8 rounded-full text-xs" />
      </span>
    </button>
  );
}
