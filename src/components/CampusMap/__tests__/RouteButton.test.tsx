import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RouteButton } from '../RouteButton';

describe('RouteButton', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz' });
  });

  it('shows the picker only once asked', () => {
    render(<RouteButton />);
    expect(screen.queryByText('Q')).toBeNull();
    fireEvent.click(screen.getByText(/Najdi cestu/));
    expect(screen.getByText('Q')).toBeTruthy();
  });

  it('offers exactly the buildings the ROUTER can reach', () => {
    // Read from the graph, not buildings.json: a building the router has no
    // nodes for would be a button that cannot work.
    render(<RouteButton />);
    fireEvent.click(screen.getByText(/Najdi cestu/));
    for (const name of ['A', 'B', 'C', 'E', 'M', 'Q', 'X']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    // Budova Z (FRRMS) has no floor plan and no nodes, so it must not appear.
    expect(screen.queryByText('Z')).toBeNull();
  });

  it('asks the store for a route and closes the picker', () => {
    const routeTo = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ routeTo });
    render(<RouteButton />);
    fireEvent.click(screen.getByText(/Najdi cestu/));
    fireEvent.click(screen.getByText('Q'));
    expect(routeTo).toHaveBeenCalledWith('Q');
    expect(screen.queryByText('A')).toBeNull();
  });

  it('cannot be pressed twice while a fix is in flight', () => {
    useAppStore.setState({ routeStatus: 'locating' });
    render(<RouteButton />);
    expect(screen.getByText(/Najdi cestu/).closest('button')).toBeDisabled();
  });
});
