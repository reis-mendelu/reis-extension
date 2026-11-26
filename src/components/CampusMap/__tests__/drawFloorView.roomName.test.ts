import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import L from 'leaflet';
import { drawFloorView } from '../drawFloorView';
import { initLeafletMap } from '../mapLayers';
import { useAppStore } from '../../../store/useAppStore';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta, RoomFeature } from '../../../types/campusMap';
import type { CanvasRefs } from '../useCanvasRefs';

// The camera is not what is under test, and a jsdom map has no size to frame.
vi.mock('../frameFloor', () => ({ frameFloor: vi.fn() }));

// Task List, November 2026: "při zobrazení budovy v mapě se neukazuje název
// každé místnosti, i když ji pak rozkliknu". Only rooms drawn bigger than
// LABELLED_ROOM_SPAN_M carry a name on the plan; every other room's name was a
// hover tooltip, and a phone has no hover. Dominik's decision: no more
// permanent labels (that wall of codes is why there is a cut-off) — a tap on
// ANY named room opens one compact card with its name instead.
const META = buildingsJson as BuildingsMeta;
const BUILDING = META.buildings[0]!;
const [lat, lng] = [BUILDING.bounds[0]![0]!, BUILDING.bounds[0]![1]!];

function room(id: number, name: string, passport: string | null, size: number): RoomFeature {
  // `size` degrees of latitude on a side; 0.00002° is about 2 m.
  const ring = [
    [lng, lat],
    [lng + size, lat],
    [lng + size, lat + size],
    [lng, lat + size],
    [lng, lat],
  ];
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      id,
      buildingId: BUILDING.id,
      floorId: 1,
      floorLevel: 1,
      name,
      type: 'classroom',
      category: 'teaching',
      label: name,
      nickname: null,
      passportNumber: passport,
      seats: null,
      hasProjector: false,
      hasWhiteboard: false,
      code: null,
    },
  } as RoomFeature;
}

const SMALL = room(11, 'Q02 – Kabinet', 'BQ02N9901', 0.00002);
const BIG = room(12, 'Q03 – Posluchárna', 'BQ03N9902', 0.0004);
const NAMELESS = room(13, '', null, 0.00002);

describe('a tap on a floor-plan room', () => {
  let el: HTMLDivElement;
  let map: L.Map;

  const draw = (isPhone: boolean) => {
    const layer = L.layerGroup().addTo(map);
    const refs = {
      buildingPolysRef: { current: new Map() },
      planBoundsRef: { current: null },
      exitHandlerRef: { current: null },
      keepViewRef: { current: false },
      roomPolysRef: { current: new Map() },
      labelledRoomsRef: { current: [] },
      railRef: { current: { width: 0, open: false } },
    } as unknown as CanvasRefs;
    drawFloorView({
      map,
      layer,
      select: useAppStore.getState(),
      refs,
      isPhone,
      activeBuildingId: BUILDING.id,
      activeFloorId: 1,
      roomsByBuilding: {
        [BUILDING.id]: { type: 'FeatureCollection', features: [SMALL, BIG, NAMELESS] },
      },
    });
    return refs;
  };

  const tap = (refs: CanvasRefs, id: number) => {
    const { poly } = refs.roomPolysRef.current.get(id)!;
    poly.fire('click', { latlng: poly.getBounds().getCenter() });
  };
  const popupText = () => document.querySelector('.room-name-popup')?.textContent ?? null;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    map = initLeafletMap(el, [
      [49.209, 16.613],
      [49.212, 16.619],
    ]);
    useAppStore.setState({ mapRoomTints: {}, mapSelection: null, venuePins: [] });
  });
  afterEach(() => {
    map.remove();
    el.remove();
  });

  it('opens a card with the name and code of a small room, which has no permanent label', () => {
    const refs = draw(true);
    tap(refs, 11);
    expect(popupText()).toBe('Q02 – Kabinet');
  });

  it('opens the same card on a room that does carry a permanent code', () => {
    const refs = draw(true);
    tap(refs, 12);
    expect(popupText()).toBe('Q03 – Posluchárna');
  });

  it('moves the card to the next room instead of stacking a second one', () => {
    const refs = draw(true);
    tap(refs, 11);
    tap(refs, 12);
    expect(document.querySelectorAll('.room-name-popup')).toHaveLength(1);
    expect(popupText()).toBe('Q03 – Posluchárna');
  });

  it('shows no card for a room IS gives no name', () => {
    const refs = draw(true);
    tap(refs, 13);
    expect(popupText()).toBeNull();
  });

  it('still selects the room it opened the card for', () => {
    const refs = draw(true);
    tap(refs, 11);
    const sel = useAppStore.getState().mapSelection;
    expect(sel?.kind === 'room' && sel.room.id).toBe(11);
  });

  it('leaves a room a screen has claimed to that screen (the library tints its own)', () => {
    useAppStore.setState({ mapRoomTints: { 11: { fill: '#16a34a', label: 'Týmová 1' } } });
    const refs = draw(true);
    tap(refs, 11);
    expect(popupText()).toBeNull();
  });

  it('does not stack a hover tooltip over the card on a phone, where a tap fires mouseover', () => {
    const refs = draw(true);
    const { poly } = refs.roomPolysRef.current.get(11)!;
    expect(poly.getTooltip()).toBeUndefined();
  });

  it('keeps the desktop as it was: hover tooltip, and the click opens DetailPanel, not a card', () => {
    const refs = draw(false);
    const { poly } = refs.roomPolysRef.current.get(11)!;
    expect(poly.getTooltip()).toBeDefined();
    tap(refs, 11);
    expect(popupText()).toBeNull();
  });

  it('keeps the card below the search bar, which sits lower by the notch (--safe-top)', () => {
    const padTop = () => {
      const refs = draw(true);
      tap(refs, 11);
      const popup = (map as unknown as { _popup: L.Popup })._popup;
      return (popup.options.autoPanPaddingTopLeft as L.Point).y;
    };
    expect(padTop()).toBe(96);
    document.documentElement.style.setProperty('--safe-top', '47px');
    try {
      expect(padTop()).toBe(96 + 47);
    } finally {
      document.documentElement.style.removeProperty('--safe-top');
    }
  });
});
