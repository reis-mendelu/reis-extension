import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The MAP has to be on screen when the student arrives from the timetable.
 *
 * The offer itself is pinned to the room now, not carried in this sheet — but
 * a sheet left open on the events list is 45% of the screen in front of the
 * room it was just asked about. A student who had dragged it up (which is
 * where a tapped event pin leaves it) crossed over from their lecture to a
 * list of society events with their room behind it.
 */
describe('MapSheet when a lecture is offered as a walk', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    // `clearRoute` keeps the offer now — the × puts the line away, it does
    // not forget the lecture — so a test that wants a clean slate says so.
    useAppStore.getState().suggestRoute(null);
    useAppStore.setState({ language: 'cz', mapSheetState: 'expanded' });
  });

  it('comes back to the peek row so the room is visible', async () => {
    render(<MapSheet />);

    // Awaited: `suggestRoute` also takes a quiet position fix to decide
    // whether the offer is worth making, so it is a promise now.
    await act(async () => {
      await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    });

    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('carries no route button of its own any more', async () => {
    // The ask moved onto the floor plan, at the room it is about — see
    // roomRouteChip. Two controls saying "Najdi cestu" on one screen was one
    // too many, and the sheet's was the one further from the question.
    await act(async () => {
      await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    });
    render(<MapSheet />);
    expect(screen.queryByText(/Najdi cestu|Doveď mě do/)).toBeNull();
  });

  it('leaves a sheet the student opened alone when nothing was suggested', () => {
    render(<MapSheet />);
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });

  it('clears the floating nav by the safe inset too, not just by 72px', async () => {
    // Hugging its content is what a drawn route puts the sheet into, and the
    // BottomNav floats OVER the sheet at `bottom-[calc(18px + --safe-bottom)]`
    // — it rides the gesture bar. A flat 72px does not, so on a Pixel the
    // nav rose by the inset and sat on the event band's second line: measured
    // at 390px, the last row ended 12px above the nav before the inset was
    // counted, and behind it on the device.
    await act(async () => {
      useAppStore.setState({ routeStatus: 'ready' } as never);
    });
    render(<MapSheet />);
    const sheet = screen.getByTestId('map-sheet');
    expect(sheet.className).toContain('var(--safe-bottom,0px)');
  });
});
