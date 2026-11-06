import { useAppStore } from '../../../../store/useAppStore';
import { useViewportSize } from '../../../../hooks/ui/useViewportSize';
import { railMaxHeight } from '../../../../utils/mapRail';
import { floorStackRows } from '../../../CampusMap/floorStackRows';

/**
 * The open rail's max-height (see `railMaxHeight`). On a touch screen the floor
 * column stands at the right edge below the rail, and the rail stops above it;
 * on a Mac the column is top-left and the rail keeps its 55vh.
 */
export function useRailMaxHeight(): string {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const isTouch = useAppStore((s) => s.isTouch);
  const viewport = useViewportSize();
  return railMaxHeight(viewport.height, isTouch ? floorStackRows(activeBuildingId) : null);
}
