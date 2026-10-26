import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { directionsFor, type RoomDirectionsView } from './roomDirectionsFor';

/** The selected room's floor-first directions, or null (see directionsFor). */
export function useRoomDirections(): RoomDirectionsView | null {
  const selection = useAppStore((s) => s.mapSelection);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  return useMemo(() => directionsFor(selection, roomsByBuilding), [selection, roomsByBuilding]);
}
