import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';
import buildingsJson from '../../data/map/buildings.json';
import { railOffsetPx } from '../../utils/mapRail';
import { ringToLatLng, remotePlaceBounds, BUILDING_STYLE } from './mapHelpers';
import { flyAndReveal, drawLandmarks } from './mapLayers';
import { drawRemotePlaces, REMOTE, REMOTE_IDS } from './remoteLayers';
import { drawCampusPaths } from './pathLayers';
import { LABELS_PANE } from './mapPanes';
import { panPinClearOfSheet } from './sheetClearance';
import type { BuildingsMeta } from '../../types/campusMap';
import type { CanvasRefs } from './useCanvasRefs';

const META = buildingsJson as BuildingsMeta;

/**
 * How close a focused event gets.
 *
 * Deliberately well short of the 18 a landmark uses: an event answers "where in
 * Brno is this", and a building-level frame answers "what does this doorway
 * look like". See the note at the call site.
 */
const EVENT_ZOOM = 16;

/**
 * The campus overview: walkways, building outlines, landmarks and remote
 * sites, the tap-away handler, and where the camera goes. Part of
 * useMapScene's one camera-owning effect, not an effect of its own.
 */
export function drawCampusOverview(a: {
  map: L.Map;
  layer: L.LayerGroup;
  select: AppState;
  refs: CanvasRefs;
  isPhone: boolean;
  focusTarget: AppState['mapFocusTarget'];
  cameFromMapTap: boolean;
}): void {
  const { map, layer, select, isPhone, focusTarget, cameFromMapTap } = a;
  const { planBoundsRef, buildingPolysRef, exitHandlerRef, keepViewRef, railRef, draftCoordRef } =
    a.refs;
  planBoundsRef.current = null;
  // Paths first: the building outlines and the event pins belong on top of
  // them. A selected route lifts itself back above with bringToFront.
  drawCampusPaths(layer);
  buildingPolysRef.current = new Map();
  for (const b of META.buildings) {
    const poly = L.polygon(ringToLatLng(b.outline.coordinates[0]!), BUILDING_STYLE)
      // Tapping a building opens its floor plan, and that is the only
      // thing it does. It used to mean something else while a gate was
      // chosen — "this is where I am going" — so the same tap drilled in or
      // answered a question depending on state the student could not see.
      .on('click', () => select.setMapBuilding(b.id))
      .bindTooltip(b.name, {
        permanent: true,
        direction: 'center',
        className: 'building-label',
        pane: LABELS_PANE,
      })
      .addTo(layer);
    buildingPolysRef.current.set(b.name, poly);
  }
  drawLandmarks(layer, select, BUILDING_STYLE);
  drawRemotePlaces(layer, select);
  // Clicking the bare basemap (not a building outline or an event pin) clears
  // the current selection — same "click away to dismiss" as floor-view's exit.
  // Building outlines are Leaflet layers (their click doesn't reach the map);
  // event pins are HTML in our pane, so skip clicks that land inside it.
  const onOverviewClick = (e: L.LeafletMouseEvent) => {
    const t = e.originalEvent.target as HTMLElement | null;
    if (t?.closest('.leaflet-reisEvents-pane')) return;
    const state = useAppStore.getState();
    if (state.placingEvent) {
      // click-to-place: capture [lng,lat]
      state.placeDraftCoord([e.latlng.lng, e.latlng.lat]);
      return;
    }
    const sel = state.mapSelection;
    // Exiting a drilled-in remote site collapses it again (redraw) via
    // focusCampus; a plain selection just clears.
    // The library's card is left by its own Back, never by a stray tap.
    if (sel?.kind === 'library') return;
    if (sel?.kind === 'poi' && REMOTE_IDS.has(sel.poi.id)) select.focusCampus();
    else if (sel) select.clearMapSelection();
  };
  map.on('click', onOverviewClick);
  exitHandlerRef.current = onOverviewClick;
  // §6: rest at campus bounds, but fly to a chosen place's coord on
  // search/click instead of refitting campus. A place/landmark (poi) zooms in
  // to 18. An EVENT this effect runs for came from a LIST click (pin clicks
  // don't bump focusReq), so we DO fly there: zoom to 18 when at overview, but
  // never zoom back out if you're already deeper in.
  const sel = select.mapSelection;
  const pinCoord =
    sel?.kind === 'event' ? sel.event.coord : sel?.kind === 'societyPin' ? sel.pin.coord : null;
  // Choosing a place/landmark/event ports the camera INSTANTLY (like Google
  // Maps), not the slow zoom-out-pan-zoom-in "fly" — animate:false makes
  // setView/fitBounds jump and fire moveend at once (flyAndReveal reveals the
  // vector panes on that moveend).
  if (sel?.kind === 'poi') {
    // A remote site (arboretum/Lednice/…) fits its whole extent so it never
    // over-zooms past its own size; a plain poi (landmark) zooms to 18.
    const rp = REMOTE.find((p) => p.id === sel.poi.id);
    if (rp) {
      flyAndReveal(map, () =>
        map.fitBounds(remotePlaceBounds(rp) as L.LatLngBoundsExpression, {
          maxZoom: 18,
          padding: [50, 50],
          animate: false,
        })
      );
    } else {
      const [lon, lat] = sel.coord;
      flyAndReveal(map, () => map.setView([lat, lon], 18, { animate: false }));
    }
  } else if (pinCoord) {
    // A society pin chosen in the search or from the Jídelníček's S-klub
    // tab (focusSocietyPin) lands like an event from a list: same zoom,
    // same clearance from the rail and the sheet.
    const [lon, lat] = pinCoord;
    flyAndReveal(map, () => {
      // EVENT_ZOOM, and NOT `Math.max(getZoom(), …)`.
      //
      // This branch only runs for a LIST or NOTIFICATION tap — a pin click
      // never bumps focusReq — so the student has just been told an event
      // exists and has not yet been told WHERE. Zoom 18 answered a question
      // nobody asked: it framed the doorway, and a doorway looks the same
      // everywhere in Brno. At 16 the surrounding streets are in frame, and
      // someone who knows the city places it instantly and already knows
      // whether they want to go.
      //
      // The max() had to go with it: it exists to avoid yanking someone
      // OUT of a close view they chose, but arriving from a notification is
      // not a view anyone chose, and keeping their old zoom is exactly how
      // you get the doorway again.
      map.setView([lat, lon], EVENT_ZOOM, { animate: false });
      // The rail overlays the canvas, so Leaflet's centre is behind it.
      const dx = railOffsetPx(
        map.getContainer().clientWidth,
        isPhone,
        railRef.current.width,
        railRef.current.open
      );
      if (dx) map.panBy([dx, 0], { animate: false });
      // And the sheet covers its bottom on a phone. See sheetClearance.ts.
      if (isPhone) panPinClearOfSheet(map, [lat, lon]);
    });
  } else if (cameFromMapTap) {
    // Left floor-view by tapping the basemap: drop the floor plan but leave
    // the camera alone. Re-fitting the campus here threw the user all the
    // way out to the overview when all they did was tap beside a building —
    // the "Celý kampus" button exists for that, and still does it.
    //
    // Deliberately NOT wrapped in flyAndReveal: with no camera move there is
    // no re-projection to hide, and its 900ms safety reveal would blank the
    // vector panes for most of a second on a `moveend` that never comes.
  } else if (focusTarget === 'draft' && draftCoordRef.current) {
    // "Ukázat na mapě": the society is checking where an unpublished event
    // will land. Deliberately NOT a consume-once flag — this effect runs
    // more than once per request, and the version that spent the flag on
    // its first run had the second run re-fit the campus on top of the
    // move. Idempotent is the point: every re-run re-answers "the draft".
    // Never zooms back OUT on someone already looking closer.
    const [lon, lat] = draftCoordRef.current;
    flyAndReveal(map, () =>
      map.setView([lat, lon], Math.max(map.getZoom(), 18), { animate: false })
    );
  } else {
    flyAndReveal(map, () =>
      map.fitBounds(META.campus.bounds as L.LatLngBoundsExpression, {
        maxZoom: 18,
        padding: [40, 40],
        animate: false,
      })
    );
  }
  keepViewRef.current = false;
  return;
}
