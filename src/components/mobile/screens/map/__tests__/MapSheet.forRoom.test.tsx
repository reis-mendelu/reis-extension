import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * A lesson in a room with no floor plan lands on its building (T18 → pin T),
 * and the peek row is the only thing on a phone that says so. A sheet left open
 * on the events list would hide that row and the pin together.
 */
describe('MapSheet when a lesson is shown at its building', () => {
  beforeEach(() =>
    useAppStore.setState({ language: 'cz', mapSheetState: 'expanded', mapSelection: null })
  );

  it('comes back to the peek row', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusRoomByCode('T18'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('leaves the sheet alone for a plain pin selection', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusPoiById(1572));
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });
});
