import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventPinPlacement } from './useEventPinPlacement';
import { spreadPins, type PinObstacle } from './spreadPins';
import { SportIcon } from './SportIcon';
import { SPORT_PLACES } from './sportPlaces';
import { getMapInstance } from './mapInstance';
import { panPinClearOfSheet } from './sheetClearance';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import type { SocietyPin, SportPlace } from '../../types/campusMap';

/**
 * The basemap is light in both themes (as SocietyPinLayer notes), so a pin
 * carries its own white face and a fixed colour rather than a theme token.
 * Teal: not a society's colour, and not the blue of the campus buildings.
 */
const PIN_INK = '#0F6E56';
/** A pin's footprint plus a hair: closer than this and two pins would touch. */
const PIN_GAP = 32;
/** Half our pin's 28px face: the clearance an obstacle needs on top of its own size. */
const PIN_RADIUS = 14;

/**
 * The room a society pin or venue takes: its 36px logo and, for a venue, the
 * name label hanging under it (11px bold, ~6.6px a character).
 */
function obstacleOf(pin: SocietyPin, x: number, y: number): PinObstacle {
  if (!pin.venue) return { x, y, r: 18 + PIN_RADIUS };
  return { x, y: y + 12, r: PIN_RADIUS + Math.max(23, pin.title.length * 3.3) };
}

/**
 * The Sportera places, one pin each, while Sport is on. On the events' pane and
 * placement, like the society pins, so a tap on one never reaches the map's
 * tap-away. Pins a few metres apart (a court and the pitch beside it) are set
 * side by side rather than drawn on top of each other. Not over a floor plan.
 */
export function SportPlaceLayer() {
  const on = useAppStore((s) => s.sportPlacesOn);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const select = useAppStore((s) => s.selectSportPlace);
  const societyPins = useAppStore((s) => s.societyPins);
  const venuePins = useAppStore((s) => s.venuePins);
  const items = useMemo(
    () =>
      on && activeBuildingId === null
        ? SPORT_PLACES.map((place) => ({ key: place.id, coord: place.coord, place }))
        : [],
    [on, activeBuildingId]
  );
  const { placed, pane } = useEventPinPlacement(items, null);
  // Where SocietyPinLayer draws, so a sport pin never lands on S-klub's name.
  const others = useMemo(
    () =>
      on && activeBuildingId === null
        ? [...venuePins, ...societyPins].map((pin) => ({ key: pin.id, coord: pin.coord, pin }))
        : [],
    [on, activeBuildingId, venuePins, societyPins]
  );
  const { placed: othersPlaced } = useEventPinPlacement(others, null);
  const otherPins = new Map(others.map((o) => [o.key, o.pin]));
  const obstacles = othersPlaced
    .filter((p) => otherPins.has(p.key))
    .map((p) => obstacleOf(otherPins.get(p.key)!, p.x, p.y));
  const live = new Map(items.map((i) => [i.key, i.place]));
  const visible = spreadPins(
    placed.filter((p) => live.has(p.key)),
    PIN_GAP,
    obstacles
  );
  if (!pane || visible.length === 0) return null;
  const selectedId = selection?.kind === 'sportPlace' ? selection.place.id : null;

  return createPortal(
    <>
      {visible.map((p) => (
        <SportPin
          key={p.key}
          place={live.get(p.key)!}
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

function SportPin({
  place,
  x,
  y,
  selected,
  onSelect,
}: {
  place: SportPlace;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (place: SportPlace) => void;
}) {
  const { t } = useTranslation();
  const isPhone = usePhoneViewport();
  const choose = () => {
    onSelect(place);
    // The sheet rises to fit the card, over whatever was in the lower half of
    // the map — so the pin just tapped would end up under it. Moved into the
    // strip between the search and the sheet, as a list tap already is.
    // Measured where the pin is DRAWN: spreadPins may have moved it off its
    // place's own coordinate, and that is the pin the student is looking at.
    const map = getMapInstance();
    if (isPhone && map)
      panPinClearOfSheet(map, map.layerPointToLatLng([x, y]), {
        afterMs: 340,
        onlyIfCovered: true,
      });
  };
  return (
    <button
      type="button"
      data-testid="sport-pin"
      // p-[8px] around the 28px face keeps the tap target at 44px.
      className="group pointer-events-auto absolute left-0 top-0 p-[8px] leaflet-zoom-animated"
      style={{
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
        zIndex: selected ? 1 : 0,
      }}
      aria-label={place.name}
      aria-pressed={selected}
      onClick={choose}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110 ${
          selected ? 'h-[34px] w-[34px]' : 'h-7 w-7'
        }`}
        style={{
          color: PIN_INK,
          boxShadow: `0 0 0 ${selected ? 3 : 2}px ${PIN_INK}, 0 1px ${selected ? 7 : 4}px rgba(0,0,0,${selected ? 0.4 : 0.28})`,
        }}
      >
        <SportIcon sport={place.sport} size={selected ? 19 : 16} />
      </span>
      {/* Named only once chosen: seven names would bury the map they sit on. */}
      {selected && (
        <span
          className="pointer-events-none absolute left-1/2 top-full -mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-1.5 py-px text-[11px] font-bold shadow"
          style={{ color: '#111827' }}
        >
          {t(`map.sport.kind.${place.sport}`)}
        </span>
      )}
    </button>
  );
}
