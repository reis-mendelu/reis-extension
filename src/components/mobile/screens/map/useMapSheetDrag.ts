import { useState, type RefObject } from 'react';
import { useSheetDrag } from '../../primitives/useSheetDrag';
import { snapDetent, consumesTravel, type Detent } from '../../primitives/sheetDrag';

/**
 * The map sheet's drag: the live height while a finger is down, and which stop
 * it lands on when the finger lifts.
 *
 * The gesture plumbing — ownership, the non-passive touch claim, pointer
 * capture, click suppression — is `useSheetDrag`, shared with every other
 * sheet. This file used to own a second copy of it, which is how the two
 * drifted: that copy had the touch claim and no pointer capture, `Sheet`'s had
 * neither, and only one of the two got the device fix. What is left here is the
 * part that is genuinely the map sheet's own — it moves between STOPS rather
 * than closing, so travel maps to a height and release maps to a detent.
 */
export function useMapSheetDrag(
  sheetState: Detent,
  setSheetState: (d: Detent) => void,
  panelRef: RefObject<HTMLDivElement | null>,
  peekPx: number,
  expandedVh: number
) {
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const { consumeDragClick, handlers } = useSheetDrag({
    panelRef,
    // Travel the sheet cannot absorb belongs to the content: at peek a downward
    // drag has nowhere to go, and at the top an upward one scrolls the list.
    absorbs: (dy) => consumesTravel(sheetState, dy),
    onMove: (dy, startHeight) => {
      // Clamped to the ladder's ends: peek is the floor, because this sheet is
      // the only way to reach Akce, and the tallest stop is the ceiling.
      const max = window.innerHeight * expandedVh;
      setDragHeight(Math.min(Math.max(startHeight - dy, peekPx), max));
    },
    onEnd: (dy, velocity) => {
      setDragHeight(null);
      const next = snapDetent(sheetState, dy, velocity);
      setSheetState(next);
      // Changing stop counts as having moved the sheet even when the travel was
      // under the slop, so the trailing click cannot advance a second stop.
      return next !== sheetState;
    },
    onCancel: () => setDragHeight(null),
  });

  return { dragHeight, consumeDragClick, handlers };
}
