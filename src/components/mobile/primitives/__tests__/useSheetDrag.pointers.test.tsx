import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useSheetDrag, type SheetDragConfig } from '../useSheetDrag';

/**
 * The drag's POINTER OWNERSHIP, split from useSheetDrag.test.tsx.
 *
 * Its own file because that one was already 336 lines before these cases were
 * appended, well past the 200-line convention, and adding to it made that
 * worse. Only this block moved: restructuring the pre-existing cases mid-PR is
 * how coverage gets lost quietly. Raised in review on this PR.
 */

type Recorded = {
  moves: [number, number][];
  ends: [number, number][];
  /**
   * Cancellations, as an array rather than a counter.
   *
   * `react-hooks/immutability` forbids `rec.cancels += 1` — assignment into a
   * prop member — and aliasing the prop does not satisfy it, because the rule
   * follows the alias. Pushing onto an array it already holds is the same kind
   * of recording the other two fields do, and needs no compound assignment.
   */
  cancels: unknown[];
  /** What onEnd should report back: did the gesture move the sheet? */
  claim?: boolean;
};

function Harness({
  rec,
  ...cfg
}: { rec: Recorded } & Partial<
  Omit<SheetDragConfig, 'panelRef' | 'onMove' | 'onEnd' | 'onCancel'>
>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { handlers, consumeDragClick } = useSheetDrag({
    panelRef,
    onMove: (dy, h) => rec.moves.push([dy, h]),
    // The second argument is the release VELOCITY in px/ms, not a duration —
    // it was renamed when the drag stopped averaging over the whole gesture,
    // and this harness kept calling it `dt`.
    onEnd: (dy, velocity) => {
      rec.ends.push([dy, velocity]);
      return rec.claim;
    },
    onCancel: () => rec.cancels.push(1),
    ...cfg,
  });
  return (
    <div ref={panelRef} data-testid="panel" {...handlers}>
      <button data-testid="inner" onClick={() => rec.moves.push([-1, -1])}>
        tap me
      </button>
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        content
      </div>
      <button data-testid="guarded" onClick={() => consumeDragClick() || rec.ends.push([-1, -1])}>
        guarded
      </button>
    </div>
  );
}

const fresh = (): Recorded => ({ moves: [], ends: [], cancels: [] });

/**
 * One finger owns the gesture.
 *
 * Every `pointerdown` used to overwrite the drag's start point, and the move,
 * up and cancel handlers never checked which pointer they came from. So a
 * second finger landing mid-drag re-anchored the gesture to itself, and
 * lifting the FIRST finger then decided the outcome from travel measured
 * against the second finger's start — enough to dismiss a sheet the student was
 * holding still, or to snap the map sheet to a stop nobody aimed at.
 *
 * Two-finger touches on a sheet are not exotic: a pinch that starts on the
 * panel, or a thumb resting on the screen while the index finger drags, both
 * produce this. Raised in review on this PR.
 */
describe('useSheetDrag — one pointer at a time', () => {
  it('ignores a second finger that lands mid-drag', () => {
    const rec = fresh();
    render(<Harness rec={rec} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 340, pointerId: 1 });
    // A second finger arrives. It must not become the gesture.
    fireEvent.pointerDown(panel, { clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(panel, { clientY: 360, pointerId: 1 });

    // Both moves are measured from the FIRST finger's start, not re-anchored.
    expect(rec.moves.map(([dy]) => dy)).toEqual([40, 60]);
  });

  it('reports travel from the owning finger when it lifts', () => {
    const rec = fresh();
    render(<Harness rec={rec} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerDown(panel, { clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(panel, { clientY: 330, pointerId: 1 });
    fireEvent.pointerUp(panel, { clientY: 330, pointerId: 1 });

    // 30, from finger 1. Re-anchored to finger 2 this was 230 — past every
    // dismiss threshold in the app.
    expect(rec.ends.map(([dy]) => dy)).toEqual([30]);
  });

  it('ignores moves and releases from a finger it does not own', () => {
    const rec = fresh();
    render(<Harness rec={rec} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 500, pointerId: 2 });
    fireEvent.pointerUp(panel, { clientY: 500, pointerId: 2 });

    expect(rec.moves).toEqual([]);
    expect(rec.ends).toEqual([]);
  });

  it('does not let a stray cancel from another finger reset the drag', () => {
    const rec = fresh();
    render(<Harness rec={rec} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 340, pointerId: 1 });
    fireEvent.pointerCancel(panel, { clientY: 340, pointerId: 2 });
    expect(rec.cancels).toHaveLength(0);
    // Still ours, still tracking.
    fireEvent.pointerMove(panel, { clientY: 360, pointerId: 1 });
    expect(rec.moves.map(([dy]) => dy)).toEqual([40, 60]);
  });

  it('frees the gesture once the owning finger is done', () => {
    const rec = fresh();
    render(<Harness rec={rec} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(panel, { clientY: 310, pointerId: 1 });
    // A later, unrelated finger must be able to start a fresh drag.
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 7 });
    fireEvent.pointerMove(panel, { clientY: 250, pointerId: 7 });
    expect(rec.moves.map(([dy]) => dy)).toEqual([50]);
  });
});
