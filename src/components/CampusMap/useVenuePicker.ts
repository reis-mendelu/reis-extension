import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import type { Room } from './composerPost';

type Coord = [number, number];

/** A picked room or place, and where the draft pin stood when it was picked. */
interface Pick {
  room: Room | null;
  placeName: string | null;
  at: Coord | null;
}

const sameCoord = (a: Coord, b: Coord | null) => !!b && a[0] === b[0] && a[1] === b[1];

/**
 * The composer's venue state and the handful of ways it changes: a picked
 * room, a searched place, a hand-dropped or pasted pin, or cleared back to
 * none (tba).
 * Split out of EventComposer so its line budget covers the fields it lays
 * out, not the venue bookkeeping behind one of them.
 *
 * `startCoord` is the edited/duplicated event's coordinate — the one
 * openComposer seeds draftCoord with — so an untouched edit keeps its room.
 */
export function useVenuePicker(
  startRoom: Room | null,
  startPlaceName: string | null,
  startCoord: Coord | null
) {
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const placeDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const previewDraftOnMap = useAppStore((s) => s.previewDraftOnMap);
  const isPhone = usePhoneViewport();

  const [pick, setPick] = useState<Pick>({
    room: startRoom,
    placeName: startPlaceName,
    at: startCoord,
  });

  // The draft pin can be moved without going through this hook: clicking it
  // (EventLayer) calls beginPlacing on the store directly. A room or place
  // name is therefore only current while the pin is still where the pick put
  // it; once it moves, the venue is the bare point, or publish would save the
  // old room and its coordinate under the new pin.
  const current = draftCoord === null || sameCoord(draftCoord, pick.at);
  const room = current ? pick.room : null;
  const pickedName = current ? pick.placeName : null;
  const coord = room?.coord ?? draftCoord;
  // A name typed by hand, for a place the search cannot find. Unlike the
  // picked name it is the society's own words, so it stays when the pin moves.
  // null = untouched, so the picked name (or none) applies; '' = cleared.
  const [typedName, setTypedName] = useState<string | null>(null);
  const placeName = room ? null : typedName !== null ? typedName.trim() || null : pickedName;

  // The draft pin shows every venue before publishing. Beside the map the
  // camera just goes there; on a phone the map is behind a tab, so going
  // there unasked would pull the society out of the form — it gets a button
  // instead (onShowOnMap, wired to previewDraftOnMap by the caller).
  const pinned = (c: Coord) => {
    placeDraftCoord(c);
    if (!isPhone) previewDraftOnMap();
  };
  const pickRoom = (sel: Room) => {
    setTypedName(null);
    setPick({ room: sel, placeName: null, at: sel.coord });
    pinned(sel.coord);
  };
  const pickPlace = (sel: { name: string; coord: Coord }) => {
    setTypedName(null);
    setPick({ room: null, placeName: sel.name, at: sel.coord });
    pinned(sel.coord);
  };
  // A pasted coordinate: no room, no name, so it publishes exactly like a pin
  // dropped by hand.
  const pickPoint = (c: Coord) => {
    setPick({ room: null, placeName: null, at: c });
    pinned(c);
  };
  const clearVenue = () => {
    setTypedName(null);
    setPick({ room: null, placeName: null, at: null });
    clearDraftCoord();
  };
  const pickOnMap = () => {
    setPick({ room: null, placeName: null, at: null });
    beginPlacing();
  };

  return {
    room,
    placeName,
    // What the name field shows: what was typed, else the picked name.
    placeNameField: typedName ?? pickedName ?? '',
    setTypedName,
    coord,
    isPhone,
    previewDraftOnMap,
    clearDraftCoord,
    pickRoom,
    pickPlace,
    pickPoint,
    clearVenue,
    pickOnMap,
  };
}
