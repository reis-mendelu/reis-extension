import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import { railPaddingPx } from '../../utils/mapRail';
import { SELECTED_STYLE } from './mapHelpers';
import { selectedRoomId } from './roomTints';
import { drawRoomRouteChip, chipShown, clampRoomChip } from './roomRouteChip';
import { translate } from '../../i18n/translate';
import { CAMPUS_NAVIGATION_ENABLED } from '../../utils/routing/navigationEnabled';
import type { BuildingsMeta } from '../../types/campusMap';
import type { CanvasRefs } from './useCanvasRefs';

const META = buildingsJson as BuildingsMeta;

export function useRoomSelection(refs: CanvasRefs, isPhone: boolean): void {
  const { roomPolysRef, roomChipRef, mapRef, railRef } = refs;
  const mapSelection = useAppStore((s) => s.mapSelection);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const routeSuggestion = useAppStore((s) => s.routeSuggestion);
  const routeStatus = useAppStore((s) => s.routeStatus);
  const canRouteFromHere = useAppStore((s) => s.canRouteFromHere);
  const language = useAppStore((s) => s.language);
  // Highlight the selected room in place on a plain map click — restyle the live
  // polygons without a full redraw or camera move (the heavy effect above only
  // re-runs / flies on navigation + search focus, not on selection alone).
  useEffect(() => {
    const selId = selectedRoomId(mapSelection);
    let selected: L.Polygon | null = null;
    for (const [id, { poly, base }] of roomPolysRef.current) {
      if (id === selId) {
        poly.setStyle(SELECTED_STYLE);
        poly.bringToFront();
        selected = poly;
      } else poly.setStyle(base);
    }
    // The offer belongs where the question was asked, and ONLY when the
    // question came from the timetable. `routeSuggestion` is set by the pin
    // beside a lesson and by nothing else, so a student browsing the floor
    // plan — tapping rooms to see what is where — is not asked whether they
    // want walking directions to each one. Drawn here rather than in the heavy
    // effect so a selection change re-pins without rebuilding the floor.
    const building =
      routeSuggestion?.buildingName ??
      META.buildings.find((x) => x.id === activeBuildingId)?.name ??
      null;
    drawRoomRouteChip(
      roomChipRef.current,
      // Never while navigation is parked: this chip is the only control that
      // can start a walk.
      CAMPUS_NAVIGATION_ENABLED &&
        chipShown(routeSuggestion, routeStatus, canRouteFromHere) &&
        building
        ? selected
        : null,
      translate(language, 'map.routeTakeMeThere'),
      () => {
        if (building) void useAppStore.getState().routeTo(building);
      }
    );
    const map = mapRef.current;
    if (map)
      clampRoomChip(
        roomChipRef.current,
        map,
        railPaddingPx(map.getSize().x, isPhone, railRef.current.width, railRef.current.open)
      );
    // `roomsByBuilding` is a dependency because the polygons this reads are
    // built by the heavy effect, and on the way in from a lesson pin the
    // selection lands BEFORE they exist: the map arrived on the right room
    // with no chip on it, because there was no polygon to pin one to yet.
    // Re-running when the floor arrives is free — this effect restyles and
    // never touches the camera.
  }, [
    mapSelection,
    activeBuildingId,
    language,
    roomsByBuilding,
    routeSuggestion,
    routeStatus,
    canRouteFromHere,
    // Read by the pill's clamp, through railPaddingPx. Stable for the life of
    // a device but it flips on a browser resize, and re-running is free here:
    // this effect restyles and re-pins, and never touches the camera.
    isPhone,
    roomPolysRef,
    roomChipRef,
    mapRef,
    railRef,
  ]);
}
