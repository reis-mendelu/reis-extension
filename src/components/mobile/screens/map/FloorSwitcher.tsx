import { useAppStore } from '../../../../store/useAppStore';
import { FloorStack } from '../../../CampusMap/FloorStack';
import { useViewportSize } from '../../../../hooks/ui/useViewportSize';
import { floorColumnRightPx } from '../../../../utils/mapRail';

/**
 * The floor list, shown only while drilled into a building — the same
 * `FloorStack` the desktop floor picker uses, unchanged.
 *
 * There is no "whole campus" back pill any more. Tapping the basemap outside
 * the building's footprint already leaves floor view (MapCanvas's `onMapClick`,
 * which deliberately ignores taps that land in courtyards and corridors), so
 * the pill was a second control for a gesture the map already had — and it sat
 * on top of the map, in the corner a thumb reaches for while panning.
 *
 * z-[1000] matches CampusMapView's desktop chrome: Leaflet's own controls sit
 * at z-index 1000 internally, and MapCanvas doesn't isolate that away, so
 * anything meant to float above the map here has to clear the same bar.
 *
 * On a tablet it stands beside the open rail, not under it — see
 * `floorColumnRightPx`.
 */
export function FloorSwitcher() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const railOpen = useAppStore((s) => s.mapRailOpen);
  const railWidth = useAppStore((s) => s.mapRailWidth);
  const viewport = useViewportSize();
  if (activeBuildingId === null) return null;

  const right = floorColumnRightPx(viewport.width, viewport.height, railOpen, railWidth);
  return (
    <div
      data-testid="floor-switcher"
      style={{ right }}
      className="absolute bottom-[calc(190px_+_var(--safe-bottom,0px))] z-[1000]"
    >
      <FloorStack />
    </div>
  );
}
