import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MapRail } from '../MapRail';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The tablet (and a phone in landscape) shows the map panel as a rail, not a
 * sheet, so the sheet's peek row never renders there. A lesson whose room has
 * no floor plan lands on its building, and the rail has to say so — and open to
 * say it, the way it opens for a tapped pin.
 */
describe('MapRail for a room without a floor plan', () => {
  beforeEach(() =>
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: false,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: null,
    } as never)
  );

  it('opens and names the room and its building', () => {
    render(<MapRail />);
    act(() => useAppStore.getState().focusRoomByCode('T18'));
    expect(screen.getByTestId('map-rail')).toBeInTheDocument();
    expect(screen.getByText('T18')).toBeInTheDocument();
    expect(screen.getByText('Budova T · bez plánku podlaží')).toBeInTheDocument();
  });

  it('can still be closed while the room is selected', () => {
    render(<MapRail />);
    act(() => useAppStore.getState().focusRoomByCode('T18'));
    fireEvent.click(screen.getByLabelText('Skrýt panel'));
    expect(screen.queryByTestId('map-rail')).toBeNull();
  });

  it('stays closed for a plain pin selection', () => {
    render(<MapRail />);
    act(() => useAppStore.getState().focusPoiById(1572));
    expect(screen.queryByTestId('map-rail')).toBeNull();
  });
});
