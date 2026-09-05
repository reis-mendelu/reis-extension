import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapRail } from '../MapRail';
import { useAppStore } from '../../../../../store/useAppStore';
import type { MapEvent } from '../../../../../types/events';

const EVENT = {
  id: 'e1',
  title: 'Deskovky',
  societyId: 'supef',
  date: '2026-09-04',
  time: '18:30',
  location: 'Mystica',
  coord: [16.59, 49.22],
  category: 'boardgames',
  venueKind: 'offcampus',
} as unknown as MapEvent;

describe('MapRail', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: true,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: null,
      mapTab: 'akce',
    } as never);
  });

  // A rail has two states. The sheet it replaced had three detents and a
  // chevron pointing DOWN — a gesture a panel at the right-hand edge does not
  // have, which is what made the retrofit read as a sheet in disguise.
  it('closes to a single button and reopens from it', () => {
    render(<MapRail />);
    expect(screen.getByTestId('map-rail')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Skrýt panel'));
    expect(screen.queryByTestId('map-rail')).not.toBeInTheDocument();
    expect(useAppStore.getState().mapRailOpen).toBe(false);

    fireEvent.click(screen.getByLabelText('Zobrazit panel'));
    expect(screen.getByTestId('map-rail')).toBeInTheDocument();
  });

  // Otherwise the pin highlights and the answer to the tap is somewhere the
  // student cannot see.
  it('comes back on its own when a pin is selected while closed', () => {
    useAppStore.setState({ mapRailOpen: false } as never);
    const { rerender } = render(<MapRail />);
    expect(screen.queryByTestId('map-rail')).not.toBeInTheDocument();

    useAppStore.setState({ mapSelection: { kind: 'event', event: EVENT } } as never);
    rerender(<MapRail />);
    expect(useAppStore.getState().mapRailOpen).toBe(true);
    expect(screen.getByTestId('map-rail')).toBeInTheDocument();
  });

  it('takes its width from the store', () => {
    useAppStore.setState({ mapRailWidth: 420 } as never);
    render(<MapRail />);
    expect(screen.getByTestId('map-rail')).toHaveStyle({ width: '420px' });
  });

  // The edge is a resize affordance, and a screen reader should be told that
  // rather than meeting an unlabelled div.
  it('exposes its edge as a vertical separator', () => {
    render(<MapRail />);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'vertical');
    expect(sep).toHaveAccessibleName('Změnit šířku panelu');
  });

  it('offers a way back to the list from an event', () => {
    useAppStore.setState({ mapSelection: { kind: 'event', event: EVENT } } as never);
    render(<MapRail />);
    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));
    expect(useAppStore.getState().mapSelection).toBeNull();
  });
});

describe('MapRail resize is keyboard-operable', () => {
  // A tablet window, because that is the only place the rail exists. The suite
  // opens a phone (src/test/setup.ts), where `clampRailWidth` correctly floors
  // every width to RAIL_MIN_PX — half of 390 is below the card's minimum — and
  // the arrow keys would look broken while behaving exactly as designed.
  beforeAll(() => {
    (
      window as unknown as {
        happyDOM?: { setViewport(v: { width: number; height: number }): void };
      }
    ).happyDOM?.setViewport({ width: 1194, height: 834 });
  });
  afterAll(() => {
    (
      window as unknown as {
        happyDOM?: { setViewport(v: { width: number; height: number }): void };
      }
    ).happyDOM?.setViewport({ width: 390, height: 844 });
  });

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: true,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: null,
      mapTab: 'akce',
    } as never);
  });

  // Pointer handlers alone left an unfocusable div: the width could only be
  // changed by dragging, so a keyboard-only student could not change it at all.
  it('grows on ArrowLeft and shrinks on ArrowRight', () => {
    render(<MapRail />);
    const sep = screen.getByRole('separator');
    // Left grows it, because the rail is anchored right — the arrow follows the
    // edge being pushed, not the number.
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(useAppStore.getState().mapRailWidth).toBe(356);
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(useAppStore.getState().mapRailWidth).toBe(340);
  });

  it('reports its current width to a screen reader', () => {
    render(<MapRail />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '340');
  });
});
