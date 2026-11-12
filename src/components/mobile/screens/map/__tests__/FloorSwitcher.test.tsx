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

// Where the column stands on a touch screen: the right edge, 190px off the
// bottom, on the phone and on the iPad alike. The open rail makes room for it
// (MapRail's own test), not the other way round.
describe('FloorSwitcher on a touch screen', () => {
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

  // Reported from the iPad 8 (Task List, "map bug on ipad"): with the rail
  // open, the column stood 368px off the right edge, in the middle of the map
  // under the rail's bottom corner. It belongs where the phone has it.
  it('stands at the right edge with the rail open on an iPad, as on the phone', () => {
    const ipads: [number, number][] = [
      [810, 1080],
      [1080, 810],
      [834, 1112],
      [1194, 834],
      [1024, 768],
    ];
    for (const [w, h] of ipads) {
      setViewport(w, h);
      const { unmount } = render(<FloorSwitcher />);
      // The real column, not an empty wrapper: Q has eight floors.
      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
      expect(screen.getByTestId('floor-switcher').style.right).toBe('12px');
      unmount();
    }
  });

  it('stays at the edge however wide the rail is dragged', () => {
    setViewport(1194, 834);
    useAppStore.setState({ mapRailWidth: 500 } as never);
    render(<FloorSwitcher />);
    expect(screen.getByTestId('floor-switcher').style.right).toBe('12px');
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
