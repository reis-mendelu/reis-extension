import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';
import buildingsJson from '../../data/map/buildings.json';
import {
  ringToLatLng,
  LABELLED_ROOM_SPAN_M,
  categoryStyle,
  ringContains,
  SELECTED_STYLE,
  STRUCTURE_STYLE,
  SIBLING_STYLE,
} from './mapHelpers';
import { flyAndReveal, drawLandmarks } from './mapLayers';
import { frameFloor } from './frameFloor';
import { applyRoomTints, roomTapIntent, selectedRoomId } from './roomTints';
import { dimsOtherRooms } from './dimsOtherRooms';
import { LABELS_PANE } from './mapPanes';
import { roomPlanLabels } from './roomPlanLabel';
import { venueRoomTitles } from './venueSearch';
import { openRoomNamePopup } from './roomNamePopup';
import type { BuildingsMeta, RoomFeature } from '../../types/campusMap';
import type { CanvasRefs } from './useCanvasRefs';

const META = buildingsJson as BuildingsMeta;

/**
 * One floor of a building: sibling outlines, the rooms with their labels and
 * tints (the library's six included), the tap-away handler, and the camera,
 * which frames the selected room's building or the library's card. Part of
 * useMapScene's one camera-owning effect, not an effect of its own.
 */
export function drawFloorView(a: {
  map: L.Map;
  layer: L.LayerGroup;
  select: AppState;
  refs: CanvasRefs;
  isPhone: boolean;
  activeBuildingId: NonNullable<AppState['activeBuildingId']>;
  activeFloorId: AppState['activeFloorId'];
  roomsByBuilding: AppState['roomsByBuilding'];
}): void {
  const { map, layer, select, isPhone, activeBuildingId, activeFloorId, roomsByBuilding } = a;
  const {
    buildingPolysRef,
    planBoundsRef,
    exitHandlerRef,
    keepViewRef,
    roomPolysRef,
    labelledRoomsRef,
    railRef,
  } = a.refs;
  // Floor-view is indoors: the outdoor walkways are not drawn there.
  buildingPolysRef.current = new Map();

  const fc = roomsByBuilding[activeBuildingId];
  const b = META.buildings.find((x) => x.id === activeBuildingId);
  planBoundsRef.current = b ? L.latLngBounds(b.bounds as L.LatLngBoundsLiteral) : null;
  if (!fc) {
    // geometry still loading — show the building while we wait
    if (b)
      flyAndReveal(map, () =>
        map.fitBounds(b.bounds as L.LatLngBoundsExpression, {
          maxZoom: 21,
          padding: [50, 50],
          animate: false,
        })
      );
    return;
  }
  // Sibling building outlines stay drawn in floor-view and ARE the
  // navigation: click one to refocus. No BuildingBar needed.
  for (const sib of META.buildings) {
    if (sib.id === activeBuildingId) continue;
    L.polygon(ringToLatLng(sib.outline.coordinates[0]!), SIBLING_STYLE)
      .on('click', () => select.setMapBuilding(sib.id))
      .bindTooltip(sib.name, {
        permanent: true,
        direction: 'center',
        className: 'building-label',
        pane: LABELS_PANE,
      })
      .addTo(layer);
  }
  drawLandmarks(layer, select, SIBLING_STYLE);
  // Tapping the bare basemap leaves floor-view — but only from OUTSIDE the
  // building. The gaps between rooms (corridors, courtyards, stairwells) are
  // still the building, and exiting when a tap lands in one made the floor
  // plan feel like it was slipping out from under you. Tested against the
  // outline, not `bounds`: these footprints are L- and U-shaped.
  const onMapClick = (e: L.LeafletMouseEvent) => {
    // An event pin is HTML in our pane; a tap on it is not a tap on the basemap.
    // Room pins sit inside the outline, where ringContains already returns, so
    // this only matters for a pin at the edge of an odd-shaped footprint.
    if ((e.originalEvent.target as HTMLElement | null)?.closest('.leaflet-reisEvents-pane')) return;
    if (b && ringContains(b.outline.coordinates[0]!, e.latlng.lng, e.latlng.lat)) return;
    // A screen that owns the floor (the library's card) is left by its own Back.
    if (useAppStore.getState().mapSelection?.kind === 'library') return;
    keepViewRef.current = true;
    select.exitToCampus();
  };
  map.on('click', onMapClick);
  exitHandlerRef.current = onMapClick;
  // The selected room (from search/deep-link or a canvas click) gets a bold
  // highlight and the camera flies straight to it — that's the "focus".
  const sel = select.mapSelection;
  const selectedId = selectedRoomId(sel);
  const feats = fc.features
    .filter((f) => f.properties.floorId === activeFloorId)
    .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
  roomPolysRef.current.clear();
  labelledRoomsRef.current = [];
  const venueTitles = venueRoomTitles(select.venuePins);
  let targetBounds: L.LatLngBounds | null = null;
  for (const f of feats as RoomFeature[]) {
    const p = f.properties,
      struct = p.category === 'structure';
    const isSel = p.id === selectedId;
    const st = categoryStyle(p.category, p.type);
    const base: L.PathOptions = struct
      ? STRUCTURE_STYLE
      : {
          color: st.stroke,
          weight: 1,
          fillColor: st.fill,
          fillOpacity: 0.6,
          interactive: true,
          bubblingMouseEvents: false,
        };
    const effectiveBase = base;
    const poly = L.polygon(
      ringToLatLng(f.geometry.coordinates[0]!),
      isSel ? SELECTED_STYLE : effectiveBase
    );
    if (!struct) {
      poly.on('click', (e: L.LeafletMouseEvent) => {
        const s = useAppStore.getState();
        const tap = roomTapIntent(p.id, s.mapRoomTints, s.mapSelection?.kind === 'library');
        if (tap === 'claim') s.selectMapLibrary(p.id);
        else if (tap === 'select') {
          select.selectMapRoom(p);
          // The phone has no hover and no DetailPanel: a tap on ANY named room
          // answers with a compact card. Desktop opens DetailPanel on this click.
          if (isPhone) openRoomNamePopup(map, e.latlng, p, s.venuePins);
        }
      });
      roomPolysRef.current.set(p.id, { poly, base: effectiveBase, plain: effectiveBase });
      if (p.name) {
        // Label sizable rooms permanently (MyMENDELU-style); tiny rooms only on
        // hover (desktop) or on tap (phone), to avoid a wall of overlapping
        // numbers.
        const pb = poly.getBounds();
        const big = pb.getNorthEast().distanceTo(pb.getSouthWest()) > LABELLED_ROOM_SPAN_M;
        const { full, short } = roomPlanLabels(p, venueTitles);
        const shown = big ? short : full;
        labelledRoomsRef.current.push({ poly, p, big });
        // Not on the phone: there the tap opens the card above, and Leaflet
        // fires a tooltip's mouseover on that same tap, so a small room would
        // show its name twice.
        if (big || !isPhone) {
          poly.bindTooltip(shown, {
            permanent: big,
            direction: 'center',
            className: big ? 'room-label' : '',
            // A permanent number is annotation and belongs under whatever is
            // drawn on top of the map; the hover one was asked for, so it stays
            // on top.
            pane: big ? LABELS_PANE : 'tooltipPane',
          });
        }
        // The permanent label keeps only the code ("B05"); hovering the room
        // shows IS's full name ("B05 – Strojový sál"). Read at hover time, so
        // a venue name that arrived after the draw is not swapped back out.
        // Desktop only: on the phone the card carries the full name, and the
        // emulated mouseover would swap the label's code for it.
        if (big && !isPhone) {
          const now = () => roomPlanLabels(p, venueRoomTitles(useAppStore.getState().venuePins));
          poly.on('mouseover', () => poly.setTooltipContent(now().full));
          poly.on('mouseout', () => poly.setTooltipContent(now().short));
        }
      }
    }
    poly.addTo(layer);
    if (isSel) {
      poly.bringToFront();
      targetBounds = poly.getBounds();
    }
  }
  applyRoomTints(
    roomPolysRef.current,
    select.mapRoomTints,
    selectedId,
    SELECTED_STYLE,
    dimsOtherRooms(sel, select.mapRoomTints)
  );
  frameFloor({
    map,
    isPhone,
    sel,
    polys: roomPolysRef.current,
    tints: select.mapRoomTints,
    targetBounds,
    buildingBounds: (b?.bounds as L.LatLngBoundsExpression | undefined) ?? null,
    rail: railRef.current,
  });
}
