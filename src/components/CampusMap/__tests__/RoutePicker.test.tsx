import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RouteButton } from '../RouteButton';
import { RoutePicker } from '../RoutePicker';

/** The two render side by side in the sheet, so the tests mount both. */
const Sheet = () => (
  <>
    <RouteButton />
    <RoutePicker />
  </>
);

describe('RouteButton + RoutePicker', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz' });
  });

  it('shows the picker only once asked', () => {
    render(<Sheet />);
    expect(screen.queryByText('Q')).toBeNull();
    fireEvent.click(screen.getByText(/Najdi cestu/));
    expect(screen.getByText('Q')).toBeTruthy();
  });

  it('offers exactly the buildings the ROUTER can reach', () => {
    // Read from the graph, not buildings.json: a building the router has no
    // nodes for would be a button that cannot work.
    render(<Sheet />);
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
    render(<Sheet />);
    fireEvent.click(screen.getByText(/Najdi cestu/));
    fireEvent.click(screen.getByText('Q'));
    expect(routeTo).toHaveBeenCalledWith('Q');
    expect(screen.queryByText('A')).toBeNull();
  });

  it('cannot be pressed twice while a fix is in flight', () => {
    useAppStore.setState({ routeStatus: 'locating' });
    render(<Sheet />);
    expect(screen.getByText(/Najdi cestu/).closest('button')).toBeDisabled();
  });

  it('meets the 44px target the rest of the app holds itself to', () => {
    // The first version was a 32px pill and 40x32 letters, on a control pressed
    // while walking. BottomNav in this same app uses min-h-11.
    render(<Sheet />);
    expect(screen.getByText(/Najdi cestu/).closest('button')!.className).toContain('min-h-11');
    fireEvent.click(screen.getByText(/Najdi cestu/));
    expect(screen.getByText('Q').className).toContain('min-h-11');
  });

  it('keeps the picker state in the store, not in the component', () => {
    // Iron Rule, and it means a search result can open this later.
    render(<Sheet />);
    fireEvent.click(screen.getByText(/Najdi cestu/));
    expect(useAppStore.getState().routePickerOpen).toBe(true);
  });
});
