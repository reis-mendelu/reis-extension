import { useAppStore } from '../../../../store/useAppStore';
import { FloorStack } from '../../../CampusMap/FloorStack';
import { useViewportSize } from '../../../../hooks/ui/useViewportSize';
import { floorColumnPlacement } from '../../../../utils/mapRail';

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
 * `floorColumnRightPx`. On a Mac (no touch screen) it stands top-left under
 * the search bar, level with the rail's top — see `floorColumnPlacement`. It
 * comes before the search in the DOM, so the search results open over it.
 */
export function FloorSwitcher() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const railOpen = useAppStore((s) => s.mapRailOpen);
  const railWidth = useAppStore((s) => s.mapRailWidth);
  const isTouch = useAppStore((s) => s.isTouch);
  const viewport = useViewportSize();
  if (activeBuildingId === null) return null;

  const place = floorColumnPlacement(viewport.width, viewport.height, railOpen, railWidth, isTouch);
  if (place.side === 'left') {
    return (
      <div
        data-testid="floor-switcher"
        className="absolute left-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000]"
      >
        <FloorStack size={place.size} />
      </div>
    );
  }
  return (
    <div
      data-testid="floor-switcher"
      style={{ right: place.rightPx }}
      className="absolute bottom-[calc(190px_+_var(--safe-bottom,0px))] z-[1000]"
    >
      <FloorStack size={place.size} />
    </div>
  );
}
