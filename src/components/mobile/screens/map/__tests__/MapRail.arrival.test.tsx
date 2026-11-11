import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MapRail } from '../MapRail';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The iPad's events rail on arrival — Dominik, 11 November 2026. Opening the
 * Mapa tab shows it, as it always did: there is room beside the map. A room
 * the student was sent to (a lesson's pin, a teacher's office) closes it, so
 * the room is what they see.
 */
describe('MapRail — arriving on the map', () => {
  beforeEach(() =>
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      mapRailOpen: false,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: null,
    } as never)
  );

  it('opens the Mapa tab with the rail open', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    expect(useAppStore.getState().mapRailOpen).toBe(true);
  });

  it('closes the rail for a room with a floor plan', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    render(<MapRail />);
    act(() => useAppStore.getState().focusRoomByCode('Q01'));
    expect(screen.queryByTestId('map-rail')).toBeNull();
  });
});
