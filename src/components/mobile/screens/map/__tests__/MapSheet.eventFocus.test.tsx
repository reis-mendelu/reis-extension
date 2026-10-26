import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';
import type { MapEvent } from '../../../../../types/events';

/**
 * Any event focus — a pin, a list row, a Novinky row — opens the card: on a
 * phone the sheet is the only surface that can show it. A selection made at
 * peek height would otherwise be invisible.
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

describe('MapSheet — an event focus opens the card', () => {
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

  it('still opens the card straight away for a list or notification tap', () => {
    useAppStore.setState({ mapSheetState: 'peek' });
    render(<MapSheet />);
    act(() => useAppStore.getState().focusEventById('evt-city', { fly: true }));

    expect(useAppStore.getState().mapSheetState).toBe('half');
  });
});
