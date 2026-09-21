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
    useAppStore.setState({ language: 'cz', mapSheetState: 'expanded' });
  });

  it('comes back to the peek row so the room is visible', () => {
    render(<MapSheet />);

    act(() => useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' }));

    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('carries no route button of its own any more', () => {
    // The ask moved onto the floor plan, at the room it is about — see
    // roomRouteChip. Two controls saying "Najdi cestu" on one screen was one
    // too many, and the sheet's was the one further from the question.
    act(() => useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' }));
    render(<MapSheet />);
    expect(screen.queryByText(/Najdi cestu|Doveď mě do/)).toBeNull();
  });

  it('leaves a sheet the student opened alone when nothing was suggested', () => {
    render(<MapSheet />);
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });
});
