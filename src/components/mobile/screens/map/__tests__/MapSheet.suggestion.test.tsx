import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The offer has to be ON SCREEN when the student arrives from the timetable.
 *
 * The route button lives in the peek row, and the peek row is the one thing a
 * taller detent replaces. A student who had left the sheet open on the events
 * list — which is where a drag or a tapped pin leaves it — crossed over from
 * their lecture to a map holding a list of society events, with the button
 * that would walk them there hidden behind it.
 */
describe('MapSheet when a lecture is offered as a walk', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz', mapSheetState: 'expanded' });
  });

  it('comes back to the peek row so the offer is visible', () => {
    render(<MapSheet />);
    expect(screen.queryByText(/Doveď mě do/)).toBeNull();

    act(() => useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' }));

    expect(useAppStore.getState().mapSheetState).toBe('peek');
    expect(screen.getByText('Doveď mě do Q31')).toBeTruthy();
  });

  it('leaves a sheet the student opened alone when nothing was suggested', () => {
    render(<MapSheet />);
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });
});
