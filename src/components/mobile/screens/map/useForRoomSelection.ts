import { useAppStore } from '../../../../store/useAppStore';

/** The room a building selection was made for, or null — see focusRoomPlace. */
export function useForRoomSelection() {
  const selection = useAppStore((s) => s.mapSelection);
  return selection?.kind === 'poi' && selection.forRoom
    ? { room: selection.forRoom, building: selection.poi.name }
    : null;
}
