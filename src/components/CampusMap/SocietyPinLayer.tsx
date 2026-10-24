import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { useEventPinPlacement } from './useEventPinPlacement';
import type { SocietyPin } from '../../types/campusMap';

/**
 * Society pins (`map_pins`) on the campus overview: the society's logo in a
 * white ring, opening `SocietyPinCard`. Their own layer over the events' pane
 * and placement, not EventLayer's groups, so a pin is never grouped with,
 * counted as or listed among the events. Not drawn over a floor plan.
 */
export function SocietyPinLayer() {
  const pins = useAppStore((s) => s.societyPins);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const select = useAppStore((s) => s.selectSocietyPin);
  const items = useMemo(
    () =>
      activeBuildingId === null ? pins.map((pin) => ({ key: pin.id, coord: pin.coord, pin })) : [],
    [pins, activeBuildingId]
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
