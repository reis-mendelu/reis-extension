import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapRail } from '../MapRail';
import { useAppStore } from '../../../../../store/useAppStore';

function setViewport(width: number, height: number) {
  (
    window as unknown as {
      happyDOM?: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM?.setViewport({ width, height });
}

// The floor column stands at the right edge, 190px off the bottom, exactly as
// on the phone. On an iPad the open rail shares that edge, so while a building
// is open the rail stops above the column and scrolls inside itself. Building
// Q has eight floors: 8px of padding, eight 24px buttons, seven 4px gaps =
// 228px, measured in the browser at 1080x810.
describe('MapRail makes room for the floor column', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: true,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: 0,
      isTouch: true,
      mapTab: 'akce',
    } as never);
  });
  afterAll(() => setViewport(390, 844));

  it('stops above the column on an iPad 8 while a building is open', () => {
    for (const [w, h] of [
      [1080, 810],
      [810, 1080],
    ] as const) {
      setViewport(w, h);
      const { unmount } = render(<MapRail />);
      expect(screen.getByTestId('map-rail').style.maxHeight).toBe(
        'min(55vh, calc(100% - 5rem - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 430px))'
      );
      unmount();
    }
  });

  it('keeps its 55vh cap with no building open', () => {
    setViewport(1080, 810);
    useAppStore.setState({ activeBuildingId: null } as never);
    render(<MapRail />);
    expect(screen.getByTestId('map-rail').style.maxHeight).toBe('55vh');
  });

  // On a Mac the column stands top-left under the search, nowhere near the rail.
  it('keeps its 55vh cap without a touch screen', () => {
    setViewport(1782, 919);
    useAppStore.setState({ isTouch: false } as never);
    render(<MapRail />);
    expect(screen.getByTestId('map-rail').style.maxHeight).toBe('55vh');
  });

  // A phone on its side is too short for both; its layout is left as it was.
  it('keeps its 55vh cap on a phone in landscape', () => {
    setViewport(844, 390);
    render(<MapRail />);
    expect(screen.getByTestId('map-rail').style.maxHeight).toBe('55vh');
  });
});
