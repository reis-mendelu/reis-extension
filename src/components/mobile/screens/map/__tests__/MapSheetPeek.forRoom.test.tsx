import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../../../store/useAppStore';
import { MapSheetPeek } from '../MapSheetPeek';

/**
 * The phone has no floating card for a building pin, so a lesson sent to the
 * map for a room with no floor plan would only move the camera. The peek row
 * says what happened: which room, which building, and that there is no plan.
 */
beforeEach(() => useAppStore.setState({ language: 'cz', mapSelection: null }));

describe('MapSheetPeek for a room without a floor plan', () => {
  it('names the room and the building it is in', () => {
    useAppStore.setState({
      mapSelection: {
        kind: 'poi',
        poi: { id: 1572, name: 'T', type: 'building', url: null, phone: null, email: null },
        coord: [16.6, 49.2],
        forRoom: 'T18',
      },
    });
    render(<MapSheetPeek />);
    expect(screen.getByText('T18')).toBeInTheDocument();
    expect(screen.getByText('Budova T · bez plánku podlaží')).toBeInTheDocument();
  });

  it('keeps the next-event row for a plain place selection', () => {
    useAppStore.setState({
      mapSelection: {
        kind: 'poi',
        poi: { id: 1572, name: 'T', type: 'building', url: null, phone: null, email: null },
        coord: [16.6, 49.2],
      },
    });
    render(<MapSheetPeek />);
    expect(screen.queryByText('T18')).toBeNull();
  });
});
