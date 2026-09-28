import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import type { Room } from './composerPost';

/**
 * The composer's venue state and the handful of ways it changes: a picked
 * room, a searched place, a hand-dropped pin, or cleared back to none (tba).
 * Split out of EventComposer so its line budget covers the fields it lays
 * out, not the venue bookkeeping behind one of them.
 */
export function useVenuePicker(startRoom: Room | null, startPlaceName: string | null) {
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const placeDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const previewDraftOnMap = useAppStore((s) => s.previewDraftOnMap);
  const isPhone = usePhoneViewport();

  const [room, setRoom] = useState<Room | null>(startRoom);
  const [placeName, setPlaceName] = useState<string | null>(startPlaceName);

  const coord = room?.coord ?? draftCoord;

  // The draft pin shows every venue before publishing. Beside the map the
  // camera just goes there; on a phone the map is behind a tab, so going
  // there unasked would pull the society out of the form — it gets a button
  // instead (onShowOnMap, wired to previewDraftOnMap by the caller).
  const pinned = (c: [number, number]) => {
    placeDraftCoord(c);
    if (!isPhone) previewDraftOnMap();
  };
  const pickRoom = (sel: Room) => {
    setRoom(sel);
    setPlaceName(null);
    pinned(sel.coord);
  };
  const pickPlace = (sel: { name: string; coord: [number, number] }) => {
    setRoom(null);
    setPlaceName(sel.name);
    pinned(sel.coord);
  };
  const clearVenue = () => {
    setRoom(null);
    setPlaceName(null);
    clearDraftCoord();
  };
  const pickOnMap = () => {
    setRoom(null);
    setPlaceName(null);
    beginPlacing();
  };

  return {
    room,
    placeName,
    coord,
    isPhone,
    previewDraftOnMap,
    clearDraftCoord,
    pickRoom,
    pickPlace,
    clearVenue,
    pickOnMap,
  };
}
