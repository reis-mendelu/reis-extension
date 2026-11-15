import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventPinPlacement } from './useEventPinPlacement';
import { spreadPins } from './spreadPins';
import { SportIcon } from './SportIcon';
import { SPORT_PLACES } from './sportPlaces';
import { getMapInstance } from './mapInstance';
import { panPinClearOfSheet } from './sheetClearance';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import type { SportPlace } from '../../types/campusMap';

/**
 * The basemap is light in both themes (as SocietyPinLayer notes), so a pin
 * carries its own white face and a fixed colour rather than a theme token.
 * Teal: not a society's colour, and not the blue of the campus buildings.
 */
const PIN_INK = '#0F6E56';
/** A resting pin's face, and a chosen one's. */
const FACE = 28;
const FACE_CHOSEN = 34;
/** Transparent padding around the face: a 44px tap target at rest. */
const TAP_PAD = 8;
/**
 * The closest two pins may sit: a CHOSEN pin's tap area (half its face plus
 * the padding) must stop short of a resting neighbour's face. At the face
 * width alone (32) the padding reached over the next pin, and a tap on its
 * edge opened the wrong place (Greptile, PR 679).
 */
const PIN_GAP = FACE_CHOSEN / 2 + TAP_PAD + FACE / 2 + 1;
/**
 * Places closer than this are one spot (the Schreberovy court and pitch, 6 m;
 * the Lužánky table and gym, 37 m) and get their pins side by side. Every
 * other pin stays exactly on its place, even where it meets another on screen.
 */
const SAME_SPOT_M = 50;

function sameSpot(a: SportPlace, b: SportPlace): boolean {
  const dx = (a.coord[0] - b.coord[0]) * 111_320 * Math.cos((a.coord[1] * Math.PI) / 180);
  const dy = (a.coord[1] - b.coord[1]) * 111_320;
  return Math.hypot(dx, dy) <= SAME_SPOT_M;
}

/**
 * The Sportera places, one pin each, always on the campus overview — no switch
 * in front of them (decided 2026-11-15). On the events' pane and
 * placement, like the society pins, so a tap on one never reaches the map's
 * tap-away. Places at one spot (a court and the pitch beside it) are set side
 * by side; every other pin stays on its place. A resting pin draws BELOW the
 * society and event pins, so far out, where one meets S-klub, S-klub's name
 * stays readable and its logo tappable; a chosen one comes to the top. Not
 * over a floor plan.
 */
export function SportPlaceLayer() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const select = useAppStore((s) => s.selectSportPlace);
  const items = useMemo(
    () =>
      activeBuildingId === null
        ? SPORT_PLACES.map((place) => ({ key: place.id, coord: place.coord, place }))
        : [],
    [activeBuildingId]
  );
  const { placed, pane } = useEventPinPlacement(items, null);
  const live = new Map(items.map((i) => [i.key, i.place]));
  const visible = spreadPins(
    placed.filter((p) => live.has(p.key)),
    PIN_GAP,
    (a, b) => sameSpot(live.get(a.key)!, live.get(b.key)!)
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
      // TAP_PAD around the face: a 44px tap target at rest. Sizes come from
      // the constants PIN_GAP is computed from, so the two cannot drift.
      className="group pointer-events-auto absolute left-0 top-0 leaflet-zoom-animated"
      style={{
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
        padding: TAP_PAD,
        zIndex: selected ? 1 : -1,
      }}
      aria-label={place.name}
      aria-pressed={selected}
      onClick={choose}
    >
      <span
        className="flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110"
        style={{
          width: selected ? FACE_CHOSEN : FACE,
          height: selected ? FACE_CHOSEN : FACE,
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
