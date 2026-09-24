import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';
import type { MapEvent } from '../../../../../types/events';

/**
 * Arriving on the map from a calendar row has to show the MAP.
 *
 * Reported from a Pixel 9a: tapping an answered society event in the calendar
 * "opens it straight into the detail, so I can't see the map". The sheet
 * force-opened to the ~300px event card for every selection, and the camera
 * centres the pin in the full viewport — measured at 390×844, the pin at
 * y=422 under a sheet whose top was at 373. The student had asked WHERE, and
 * the one answer on screen was hidden behind a card they had already read in
 * the calendar.
 *
 * So a calendar focus (`reveal: 'map'`) leaves the sheet at peek with the
 * event in the peek row, one tap from its card. A pin tap or a list tap still
 * opens the card: there the card IS the answer.
 */
const CITY_GAME: MapEvent = {
  id: 'evt-city',
  title: 'City Game (bring a pen)',
  url: '',
  date: '2099-09-24',
  endDate: null,
  time: '23:00',
  location: null,
  imageUrl: null,
  organizerKey: 'mendelu',
  societyId: 'esn',
  coord: [16.6083, 49.1981],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
  subscribersOnly: false,
};

// Sorted first by date, so the peek row would name it if it ignored the
// selection — which is the "peek row lies" failure this test has to catch.
const SOONER: MapEvent = {
  ...CITY_GAME,
  id: 'evt-sooner',
  title: 'Kvíz v Klubu',
  date: '2099-09-01',
};

describe('MapSheet — an event focused from the calendar', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.getState().suggestRoute(null);
    useAppStore.setState({
      language: 'cz',
      // Left open by an earlier visit: the store keeps the detent across tab
      // switches, so merely not forcing `half` would still show the card.
      mapSheetState: 'half',
      mapEvents: [SOONER, CITY_GAME],
      mapEventsLoaded: true,
      mapSelection: null,
    } as never);
  });

  it('stays at peek, naming the tapped event, so the pin is on screen', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusEventById('evt-city', { fly: true, reveal: 'map' }));

    expect(useAppStore.getState().mapSheetState).toBe('peek');
    const peek = screen.getByTestId('map-sheet-peek');
    expect(peek.textContent).toContain('City Game (bring a pen)');
    expect(peek.textContent).not.toContain('Kvíz v Klubu');
    // The card is not rendered at all at peek.
    expect(screen.queryByRole('button', { name: /Mám zájem/ })).toBeNull();
  });

  it('opens the card on one tap of the peek row, keeping the event', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusEventById('evt-city', { fly: true, reveal: 'map' }));

    // A finger, not a bare click: the sheet's drag sees the pointer first and
    // settles a zero-travel release on the detent it is already at. Routed
    // through the collapse path, that dropped the selection before the click
    // landed, and the tap opened the events list instead of the card —
    // found in the browser, invisible to a click-only test.
    const row = screen.getByTestId('map-sheet-peek');
    fireEvent.pointerDown(row, { pointerId: 1, clientY: 700 });
    fireEvent.pointerUp(row, { pointerId: 1, clientY: 700 });
    fireEvent.click(row);

    expect(useAppStore.getState().mapSheetState).toBe('half');
    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: 'evt-city' } });
    expect(screen.getByText('City Game (bring a pen)')).toBeInTheDocument();
  });

  it('opens the card when the student then taps the pin itself', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusEventById('evt-city', { fly: true, reveal: 'map' }));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
    // EventLayer's pin tap: the same event, no options. The event reference is
    // unchanged, so a sheet keyed on it would not react at all.
    act(() => useAppStore.getState().focusEventById('evt-city'));

    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('still opens the card straight away for a list or notification tap', () => {
    useAppStore.setState({ mapSheetState: 'peek' });
    render(<MapSheet />);
    act(() => useAppStore.getState().focusEventById('evt-city', { fly: true }));

    expect(useAppStore.getState().mapSheetState).toBe('half');
  });
});
