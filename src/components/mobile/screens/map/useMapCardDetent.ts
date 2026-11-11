import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import type { MapSelection } from '../../../../types/campusMap';

const CARD_KINDS = new Set<MapSelection['kind']>(['event', 'gardenPlace', 'societyPin']);
const ROOM_KINDS = new Set<MapSelection['kind']>(['room', 'roomRef']);

/**
 * How the phone's map sheet moves for a selection.
 *
 * A card (an event, a garden place, a society pin or venue) opens the sheet:
 * on a phone it is the only surface that can show one, and a selection made at
 * peek would otherwise be invisible. Where the sheet was at that moment is kept
 * (`mapCardReturn`): Back returns there — the list, if the student came from
 * it; collapsed, if they arrived from another screen or tapped a pin over the
 * map — and a card that opened on the collapsed sheet shows only its top
 * (MapSheet), the rest a pull away. Dominik, 11 November 2026.
 *
 * A room picked from a card (an event's room code) is somewhere to look AT, so
 * the sheet collapses to show it rather than falling back to the list.
 *
 * Keyed on the selection OBJECT, not the event: a second tap on the same pin
 * selects the same event reference, and must still open the card.
 */
export function useMapCardDetent() {
  const selection = useAppStore((s) => s.mapSelection);
  const setSheetState = useAppStore((s) => s.setMapSheetState);
  const setCardReturn = useAppStore((s) => s.setMapCardReturn);
  const hadCard = useRef(false);

  useEffect(() => {
    if (selection && CARD_KINDS.has(selection.kind)) {
      // One card replacing another keeps the first one's way back.
      if (!hadCard.current) setCardReturn(useAppStore.getState().mapSheetState);
      hadCard.current = true;
      setSheetState('half');
      return;
    }
    if (hadCard.current && selection && ROOM_KINDS.has(selection.kind)) setSheetState('peek');
    hadCard.current = false;
    setCardReturn(null);
  }, [selection, setSheetState, setCardReturn]);
}
