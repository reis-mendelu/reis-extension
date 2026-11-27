import { useEffect } from 'react';
import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import { railPaddingPx } from '../../utils/mapRail';
import { initLeafletMap } from './mapLayers';
import { roomLabelsHidden } from './roomLabels';
import { declutterTintLabels, selectedRoomId } from './roomTints';
import { clampRoomChip } from './roomRouteChip';
import { setMapInstance } from './mapInstance';
import type { BuildingsMeta } from '../../types/campusMap';
import type { CanvasRefs } from './useCanvasRefs';

const META = buildingsJson as BuildingsMeta;

// On DESKTOP, at the campus-overview resting zoom the lettered building names
// (X, Q, A…) just clutter the basemap and collide with event pins, so they're
// hidden via the `reis-hide-building-labels` class (src/index.css) and reappear
// the moment the user zooms IN past the overview. On a PHONE they show at rest:
// the map is the whole screen with no side panel naming anything, so the letter
// is the only way to tell one outline from another without tapping it. The
// threshold is computed live in initLeafletMap. The drill interaction is a
// click, not the label.

/** Builds the Leaflet map once, with its layer groups in paint order. */
export function useLeafletMap(refs: CanvasRefs, isPhone: boolean): void {
  const {
    ref,
    mapRef,
    layerRef,
    poiHighlightRef,
    positionLayerRef,
    routeLayerRef,
    roomChipRef,
    planBoundsRef,
    roomPolysRef,
    railRef,
  } = refs;
  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = initLeafletMap(
      ref.current,
      META.campus.bounds as L.LatLngBoundsExpression,
      isPhone
    );
    layerRef.current.addTo(map);
    poiHighlightRef.current.addTo(map);
    // Added AFTER the main layer, so the route paints over the campus rather
    // than under it. Its own group, for the reason its ref documents: the main
    // one is cleared and rebuilt on every building and floor change.
    positionLayerRef.current.addTo(map);
    routeLayerRef.current.addTo(map);
    roomChipRef.current.addTo(map);
    mapRef.current = map;
    setMapInstance(map);
    // Room names are only worth drawing while the plan is close enough to read.
    // On every camera settle rather than on a state change: the route fit is
    // what zooms out from under an open plan, and it moves the camera without
    // touching the floor the student chose. See roomLabels.
    const syncRoomLabels = () => {
      map
        .getContainer()
        .classList.toggle('reis-hide-room-labels', roomLabelsHidden(map, planBoundsRef.current));
      const st = useAppStore.getState();
      declutterTintLabels(roomPolysRef.current, st.mapRoomTints, selectedRoomId(st.mapSelection));
      // The pill is anchored to the room and the rail overlays the right of
      // the canvas, so a room near that edge puts its offer on top of the
      // panel. Re-asked on every settle, because the student can pan the room
      // there afterwards and the rail can be dragged wider under it.
      clampRoomChip(
        roomChipRef.current,
        map,
        railPaddingPx(map.getSize().x, isPhone, railRef.current.width, railRef.current.open)
      );
    };
    syncRoomLabels();
    map.on('moveend zoomend resize', syncRoomLabels);
    return () => {
      map.off('moveend zoomend resize', syncRoomLabels);
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
}
