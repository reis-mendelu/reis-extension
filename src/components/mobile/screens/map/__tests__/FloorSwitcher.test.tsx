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
      // Every case in this block is a touch screen; the Mac is the next block.
      isTouch: true,
    } as never);
  });
  afterAll(() => setViewport(390, 844));

  it('keeps the small buttons on a touch screen', () => {
    setViewport(1194, 834);
    render(<FloorSwitcher />);
    expect(screen.getByRole('button', { name: '0' })).toHaveClass('btn-xs');
  });

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

// The iPad app on a Mac: phone tree, mouse, a ~1782x919 window. Beside the
// rail the column landed in the middle of the map; it goes where the
// extension's map keeps it instead — under the search, on the left.
describe('FloorSwitcher on a Mac', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeBuildingId: 0,
      mapRailOpen: true,
      mapRailWidth: 340,
      isTouch: false,
    } as never);
  });
  afterAll(() => setViewport(390, 844));

  it('stands top-left under the search bar, clear of the rail', () => {
    setViewport(1782, 919);
    render(<FloorSwitcher />);
    const column = screen.getByTestId('floor-switcher');
    expect(column.style.right).toBe('');
    expect(column).toHaveClass('left-4');
    expect(column.className).toContain('top-[calc(5rem');
    expect(column.className).not.toContain('bottom-');
  });

  it('takes buttons a mouse can hit on a window drawn at 0.825', () => {
    setViewport(1782, 919);
    render(<FloorSwitcher />);
    expect(screen.getByRole('button', { name: '0' })).toHaveClass('btn-sm');
    expect(screen.getByRole('button', { name: '0' })).not.toHaveClass('btn-xs');
  });
});
