import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FloorSwitcher } from '../FloorSwitcher';
import { useAppStore } from '../../../../../store/useAppStore';

function setViewport(width: number, height: number) {
  (
    window as unknown as {
      happyDOM?: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM?.setViewport({ width, height });
}

// The geometry itself is `floorColumnRightPx`'s test; this pins that the
// column actually reads the rail it has to clear.
describe('FloorSwitcher beside the tablet rail', () => {
  beforeEach(() => {
    useAppStore.setState({
      // Building Q — its id in buildings.json, which is numeric.
      activeBuildingId: 0,
      mapRailOpen: true,
      mapRailWidth: 340,
    } as never);
  });
  afterAll(() => setViewport(390, 844));

  it('stands left of the open rail on an iPad in landscape', () => {
    setViewport(1194, 834);
    render(<FloorSwitcher />);
    // The real column, not an empty wrapper: Q has eight floors.
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.getByTestId('floor-switcher').style.right).toBe('368px');
  });

  it('follows the rail when it is dragged wider', () => {
    setViewport(1194, 834);
    useAppStore.setState({ mapRailWidth: 500 } as never);
    render(<FloorSwitcher />);
    expect(screen.getByTestId('floor-switcher').style.right).toBe('528px');
  });

  it('returns to the edge when the rail is closed', () => {
    setViewport(1194, 834);
    useAppStore.setState({ mapRailOpen: false } as never);
    render(<FloorSwitcher />);
    expect(screen.getByTestId('floor-switcher').style.right).toBe('12px');
  });

  it('keeps the edge on a phone, portrait or landscape', () => {
    setViewport(390, 844);
    const { unmount } = render(<FloorSwitcher />);
    expect(screen.getByTestId('floor-switcher').style.right).toBe('12px');
    unmount();
    setViewport(844, 390);
    render(<FloorSwitcher />);
    expect(screen.getByTestId('floor-switcher').style.right).toBe('12px');
  });
});
