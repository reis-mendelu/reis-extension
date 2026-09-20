import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import { drawRoute } from './routeLayers';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import { railOffsetPx } from '../../utils/mapRail';
import buildingsJson from '../../data/map/buildings.json';
import {
  ringToLatLng,
  roomLabel,
  categoryStyle,
  remotePlaceBounds,
  ringContains,
  SELECTED_STYLE,
  STRUCTURE_STYLE,
  BUILDING_STYLE,
  SIBLING_STYLE,
} from './mapHelpers';
import { initLeafletMap, flyAndReveal, drawLandmarks } from './mapLayers';
import { drawRemotePlaces, REMOTE, REMOTE_IDS } from './remoteLayers';
import {
  drawCampusPaths,
  findWalk,
  keepChipsOnScreen,
  showWalk,
  type CampusWalkLayers,
} from './pathLayers';
import { drawCampusEntrances, markActiveEntrance } from './entranceLayers';
import { markPickableBuildings } from './buildingChooser';
import { setMapInstance } from './mapInstance';
import { roomFocusView } from './focusBounds';
import type { BuildingsMeta, RoomFeature } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

/**
 * How close a focused event gets.
 *
 * Deliberately well short of the 18 a landmark uses: an event answers "where in
 * Brno is this", and a building-level frame answers "what does this doorway
 * look like". See the note at the call site.
 */
const EVENT_ZOOM = 16;

// On DESKTOP, at the campus-overview resting zoom the lettered building names
// (X, Q, A…) just clutter the basemap and collide with event pins, so they're
// hidden via the `reis-hide-building-labels` class (src/index.css) and reappear
// the moment the user zooms IN past the overview. On a PHONE they show at rest:
// the map is the whole screen with no side panel naming anything, so the letter
// is the only way to tell one outline from another without tapping it. The
// threshold is computed live in initLeafletMap. The drill interaction is a
// click, not the label.

export function MapCanvas() {
  const isPhone = usePhoneViewport();
  /**
   * The rail's live geometry, held in a ref rather than read as a dependency.
   *
   * The camera compensation has to track the CURRENT width — a fixed half-of-340
   * leaves the pin under a rail just dragged wider — but `railWidth` in the big
   * effect's dependency array made every frame of a drag re-run an effect that
   * clears layers and calls `setView`/`fitBounds`, throwing away the camera
   * position the student had. A ref gives the value at the moment of focus
   * without making the width a trigger.
   */
  const railWidth = useAppStore((s) => s.mapRailWidth);
  const railOpen = useAppStore((s) => s.mapRailOpen);
  const railRef = useRef({ width: railWidth, open: railOpen });
  // Synced in an effect, not written during render: a ref assigned mid-render
  // can leave a stale value behind when React discards a render, and the lint
  // rule that says so is right.
  useEffect(() => {
    railRef.current = { width: railWidth, open: railOpen };
  }, [railWidth, railOpen]);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());
  const exitHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  // Set only by the floor-view tap-away, so the redraw below can tell "I'm done
  // with this building" (leave the camera where the finger left it) from any
  // other caller of `exitToCampus`, which means "take me back to the whole
  // campus" and should fly there.
  const keepViewRef = useRef(false);
  // Live room polygons keyed by placeId, with their unselected base style — lets
  // a plain map click re-highlight in place without a full redraw or camera move.
  const roomPolysRef = useRef<Map<number, { poly: L.Polygon; base: L.PathOptions }>>(new Map());
  /**
   * The two halves of "how do I get to my building", held in the store beside
   * the map's other selections.
   *
   * A walk is two questions asked one at a time: tap a gate, then pick a
   * building. Answering both at once by lighting every walk from the gate put
   * seven times on the map and made the student read the whole campus to find
   * their own.
   *
   * Mirrored into refs so the redraw effect can re-apply them without taking
   * them as dependencies — as dependencies they would re-run the camera-owning
   * effect on every tap.
   */
  const selectedEntrance = useAppStore((s) => s.mapWalkEntrance);
  const selectedBuilding = useAppStore((s) => s.mapWalkBuilding);
  const activeEntranceRef = useRef<string | null>(null);
  const activeBuildingRef = useRef<string | null>(null);
  const pathsRef = useRef<CampusWalkLayers | null>(null);
  const entrancesRef = useRef<Map<string, L.CircleMarker>>(new Map());
  /** The campus building outlines, kept so they can be lit as pick targets
   *  without a redraw (a redraw moves the camera). */
  const buildingPolysRef = useRef<Map<string, L.Polygon>>(new Map());

  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);
  // The event being composed. Read here rather than moved by a separate hook:
  // this effect is the app's only camera owner, and a second one racing it is
  // exactly how "Ukázat na mapě" ended up drawing the pin while the camera sat
  // on the campus overview.
  const draftCoord = useAppStore((s) => s.draftCoord);
  const focusTarget = useAppStore((s) => s.mapFocusTarget);
  const mapSelection = useAppStore((s) => s.mapSelection);
  // The route chip says how long the walk takes, so it has to be written in the
  // student's language. Read here rather than inside the Leaflet layer, which is
  // not a component and has no hooks.
  // The computed route lives in its OWN layer group, added straight to the map
  // rather than to `layerRef`. The heavy effect below clears and rebuilds that
  // group whenever the building or floor changes, and a route drawn into it
  // would vanish on any of those — including the camera move that follows a
  // route being drawn in the first place.
  const routeLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const routeWalk = useAppStore((s) => s.routeWalk);
  const language = useAppStore((s) => s.language);
  const languageRef = useRef(language);
  // Same "latest ref" trick, same reason: moving the draft pin (picking a
  // different room) must not re-fly the camera. Only an explicit request does,
  // and that arrives as a change to draftFocusReq.
  const draftCoordRef = useRef(draftCoord);
  useEffect(() => {
    draftCoordRef.current = draftCoord;
  }, [draftCoord]);

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = initLeafletMap(
      ref.current,
      META.campus.bounds as L.LatLngBoundsExpression,
      isPhone
    );
    layerRef.current.addTo(map);
    // Added AFTER the main layer, so the route paints over the campus rather
    // than under it. Its own group, for the reason its ref documents: the main
    // one is cleared and rebuilt on every building and floor change.
    routeLayerRef.current.addTo(map);
    mapRef.current = map;
    setMapInstance(map);
    // The walk's time chip is anchored to its building, so panning or zooming
    // that building towards the edge carries the chip off it. Placing it once
    // was not enough; re-clamp whenever the camera settles or the frame
    // changes size. Registered here, where the map's lifetime is owned.
    const reclamp = () => {
      if (pathsRef.current) keepChipsOnScreen(pathsRef.current.chips, map);
    };
    map.on('moveend zoomend resize', reclamp);
    return () => {
      map.off('moveend zoomend resize', reclamp);
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
    };
    // Deliberately once-only. `isPhone` is read at construction to pick the
    // label-visibility threshold; re-running would tear down and rebuild the
    // whole Leaflet map (losing camera and layers) just to change it, and the
    // desktop/phone branches mount different trees anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = layerRef.current;
    layer.clearLayers();
    const select = useAppStore.getState();
    // Leaving floor-view by tapping the basemap keeps the camera; the "Celý
    // kampus" button still re-fits the campus. Cleared where the camera
    // decision is reached rather than here.
    const cameFromMapTap = keepViewRef.current;
    if (exitHandlerRef.current) {
      map.off('click', exitHandlerRef.current);
      exitHandlerRef.current = null;
    }

    if (activeBuildingId === null) {
      // Paths first: the building outlines and the event pins belong on top of
      // them. A selected route lifts itself back above with bringToFront.
      pathsRef.current = drawCampusPaths(layer);
      buildingPolysRef.current = new Map();
      for (const b of META.buildings) {
        const poly = L.polygon(ringToLatLng(b.outline.coordinates[0]), BUILDING_STYLE)
          .on('click', () => {
            // While a gate is chosen the buildings ARE the question — tapping
            // one answers "where are you going" instead of opening its floor
            // plan. Read from the ref so the handler sees the live step without
            // being rebound (rebinding means a redraw, and a redraw moves the
            // camera).
            if (activeEntranceRef.current) {
              select.selectWalkBuilding(b.name);
              return;
            }
            select.setMapBuilding(b.id);
          })
          .bindTooltip(b.name, {
            permanent: true,
            direction: 'center',
            className: 'building-label',
          })
          .addTo(layer);
        buildingPolysRef.current.set(b.name, poly);
      }
      drawLandmarks(layer, select, BUILDING_STYLE);
      drawRemotePlaces(layer, select);
      // The ways in, drawn after the buildings so a gate is never buried under
      // an outline.
      entrancesRef.current = drawCampusEntrances(layer, (name) => {
        // Choosing a gate IS a choice on the map, so it retires whatever place
        // or room was chosen before it — which is also what keeps the walk
        // below from being suppressed by a stale selection.
        select.clearMapSelection();
        select.selectWalkEntrance(name);
      });
      // Re-apply after a redraw (a new search, a new focus) so the walk the
      // student asked for does not quietly vanish under them.
      if (pathsRef.current)
        showWalk(
          pathsRef.current,
          findWalk(activeEntranceRef.current, activeBuildingRef.current),
          languageRef.current,
          map
        );
      markActiveEntrance(entrancesRef.current, activeEntranceRef.current);
      markPickableBuildings(
        buildingPolysRef.current,
        activeEntranceRef.current,
        activeBuildingRef.current
      );
      // Clicking the bare basemap (not a building outline or an event pin) clears
      // the current selection — same "click away to dismiss" as floor-view's exit.
      // Building outlines are Leaflet layers (their click doesn't reach the map);
      // event pins are HTML in our pane, so skip clicks that land inside it.
      const onOverviewClick = (e: L.LeafletMouseEvent) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t?.closest('.leaflet-reisEvents-pane')) return;
        const state = useAppStore.getState();
        // Tapping the bare basemap steps BACK one, rather than throwing the
        // whole thing away — the buildings are thin L-shapes and easy to miss,
        // and a near-miss that also lost the gate cost both answers.
        state.clearWalkStep();
        if (state.placingEvent) {
          // click-to-place: capture [lng,lat]
          state.placeDraftCoord([e.latlng.lng, e.latlng.lat]);
          return;
        }
        const sel = state.mapSelection;
        // Exiting a drilled-in remote site collapses it again (redraw) via
        // focusCampus; a plain selection just clears.
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
      } else if (sel?.kind === 'event' && sel.event.coord) {
        const [lon, lat] = sel.event.coord;
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

    // Floor-view is indoors: the outdoor walkways are not drawn there. No
    // selection to clear — the walks are already suppressed off the overview.
    pathsRef.current = null;
    entrancesRef.current = new Map();
    buildingPolysRef.current = new Map();

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
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
      L.polygon(ringToLatLng(sib.outline.coordinates[0]), SIBLING_STYLE)
        .on('click', () => select.setMapBuilding(sib.id))
        .bindTooltip(sib.name, {
          permanent: true,
          direction: 'center',
          className: 'building-label',
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
      if (b && ringContains(b.outline.coordinates[0], e.latlng.lng, e.latlng.lat)) return;
      keepViewRef.current = true;
      select.exitToCampus();
    };
    map.on('click', onMapClick);
    exitHandlerRef.current = onMapClick;
    // The selected room (from search/deep-link or a canvas click) gets a bold
    // highlight and the camera flies straight to it — that's the "focus".
    const sel = select.mapSelection;
    const selectedId =
      sel?.kind === 'roomRef' ? sel.entry.placeId : sel?.kind === 'room' ? sel.room.id : null;
    const feats = fc.features
      .filter((f) => f.properties.floorId === activeFloorId)
      .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
    roomPolysRef.current.clear();
    let targetBounds: L.LatLngBounds | null = null;
    for (const f of feats as RoomFeature[]) {
      const p = f.properties,
        struct = p.category === 'structure';
      const isSel = p.id === selectedId;
      const st = categoryStyle(p.category);
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
        ringToLatLng(f.geometry.coordinates[0]),
        isSel ? SELECTED_STYLE : effectiveBase
      );
      if (!struct) {
        poly.on('click', () => select.selectMapRoom(p));
        roomPolysRef.current.set(p.id, { poly, base: effectiveBase });
        if (p.name) {
          // Label sizable rooms permanently (MyMENDELU-style); tiny rooms only on
          // hover, to avoid a wall of overlapping numbers.
          const pb = poly.getBounds();
          const big = pb.getNorthEast().distanceTo(pb.getSouthWest()) > 12;
          const label = roomLabel(p.name, p.passportNumber, p.nickname);
          poly.bindTooltip(label, {
            permanent: big,
            direction: 'center',
            className: big ? 'room-label' : '',
          });
        }
      }
      poly.addTo(layer);
      if (isSel) {
        poly.bringToFront();
        targetBounds = poly.getBounds();
      }
    }
    // Which box to frame is a decision, so it lives in a tested pure module:
    // a selected room frames its BUILDING, not its own few metres of floor.
    // See focusBounds.roomFocusView.
    const view = roomFocusView<L.LatLngBoundsExpression>(
      targetBounds ?? null,
      (b?.bounds as L.LatLngBoundsExpression | undefined) ?? null
    );
    if (view) {
      const { bounds, maxZoom, padding } = view;
      flyAndReveal(map, () => map.fitBounds(bounds, { maxZoom, padding, animate: false }));
    }
    // isPhone joins the deps because the rail offset reads it. It is stable
    // for the life of a device, but it flips on a browser resize, and this
    // effect is idempotent by design (see the 'draft' branch's note), so
    // re-running it on that flip re-answers the same question correctly.
    //
    // The rail's width and open state deliberately do NOT: they are read from
    // `railRef` at the moment of focus. As dependencies they made a resize drag
    // re-run this whole effect sixty times a second, and it resets the camera.
  }, [activeBuildingId, activeFloorId, roomsByBuilding, focusReq, focusTarget, isPhone]);

  // Highlight the selected room in place on a plain map click — restyle the live
  // polygons without a full redraw or camera move (the heavy effect above only
  // re-runs / flies on navigation + search focus, not on selection alone).
  useEffect(() => {
    const selId =
      mapSelection?.kind === 'room'
        ? mapSelection.room.id
        : mapSelection?.kind === 'roomRef'
          ? mapSelection.entry.placeId
          : null;
    for (const [id, { poly, base }] of roomPolysRef.current) {
      if (id === selId) {
        poly.setStyle(SELECTED_STYLE);
        poly.bringToFront();
      } else poly.setStyle(base);
    }
  }, [mapSelection]);

  // Drawing the route is a restyle of its own layer, never a redraw of the map
  // — the heavy effect owns the camera, and re-running it here would throw away
  // the view the student is looking at.
  useEffect(() => {
    drawRoute(routeLayerRef.current, routeWalk, language);
  }, [routeWalk, language]);

  /**
   * Whose walks are actually lit, DERIVED rather than stored a second time.
   *
   * Walks only mean anything on the campus overview with nothing else chosen:
   * inside a building the walkways are not drawn, and choosing a place or an
   * event answers a different question than "how do I get to my building".
   * Deriving it keeps those three rules in one expression instead of a scatter
   * of effects that each clear the state behind the others.
   */
  const activeEntrance = activeBuildingId === null && !mapSelection ? selectedEntrance : null;
  const activeBuilding = activeEntrance ? selectedBuilding : null;

  // Showing the walk is a restyle, never a redraw — the heavy effect above owns
  // the camera, and re-running it here would throw away the view the student is
  // looking at. The refs are mirrored in the same place (and not during render,
  // for the reason the rail's own ref documents) so a redraw from some other
  // cause can put it back afterwards.
  useEffect(() => {
    activeEntranceRef.current = activeEntrance;
    activeBuildingRef.current = activeBuilding;
    languageRef.current = language;
    if (pathsRef.current)
      showWalk(
        pathsRef.current,
        findWalk(activeEntrance, activeBuilding),
        language,
        mapRef.current ?? undefined
      );
    markActiveEntrance(entrancesRef.current, activeEntrance);
    // The second question is only asked once the first is answered: no gate,
    // no lit buildings.
    markPickableBuildings(buildingPolysRef.current, activeEntrance, activeBuilding);
  }, [activeEntrance, activeBuilding, language]);

  return <div ref={ref} className="absolute inset-0" />;
}
