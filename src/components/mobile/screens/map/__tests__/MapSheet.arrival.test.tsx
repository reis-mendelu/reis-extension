import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';
import { venueRowToPin } from '../../../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../../../test/fixtures/sklubVenueRow';

const SKLUB = venueRowToPin(SKLUB_VENUE_ROW)!;

/**
 * Arriving on the map from another screen shows the MAP — Dominik, 11 November
 * 2026: "often, clicking on a button that navigates me to the map, the events
 * are expanded so I don't really see the map". The sheet's height lived in the
 * store for the whole session, and most ways in never collapsed it.
 *
 * Agreed: on a phone the Mapa tab always opens with the events collapsed; a
 * card arriving there shows its top part, the rest a pull away; Back returns to
 * where the student was — the list if they came from it, collapsed otherwise.
 */
describe('MapSheet — arriving on the map', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.getState().suggestRoute(null);
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      // Left open by an earlier visit.
      mapSheetState: 'expanded',
      mapSelection: null,
      venueMenuSection: null,
      venuePins: [SKLUB],
    } as never);
  });

  it('opens the Mapa tab with the events collapsed, however it was left', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('does not collapse a sheet the student opened while already on the map', () => {
    useAppStore.setState({ mobileTab: 'map', mapSheetState: 'half' } as never);
    act(() => useAppStore.getState().setMobileTab('map'));
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('shows only the top of a card that arrives at the collapsed sheet', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    expect(screen.getByTestId('map-sheet').className).toMatch(/\bmax-h-\[40vh\]/);
  });

  it('pulled up, the card may take the tall sheet', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    act(() => useAppStore.getState().setMapSheetState('expanded'));
    expect(screen.getByTestId('map-sheet').className).toMatch(/\bmax-h-\[70vh\]/);
  });

  it('Back from a card that arrived goes back to the collapsed sheet', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));
    expect(useAppStore.getState().mapSelection).toBeNull();
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('Back from a card opened off the list goes back to the list', () => {
    useAppStore.setState({ mobileTab: 'map', mapSheetState: 'half' } as never);
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  // Review on #666: a card left from the last visit re-opened over the map.
  it('leaving the map drops its selection, so coming back shows the map', () => {
    useAppStore.setState({ mobileTab: 'map' } as never);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    act(() => useAppStore.getState().setMobileTab('calendar'));
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('keeps a selection made on the way in', () => {
    act(() => useAppStore.getState().focusSocietyPin(SKLUB)); // from Jídelníček
    act(() => useAppStore.getState().setMobileTab('map'));
    expect(useAppStore.getState().mapSelection?.kind).toBe('societyPin');
  });

  // Review on #666: the 40vh cap held the sheet back mid-drag.
  it('a compact card follows the finger up past its cap', () => {
    act(() => useAppStore.getState().setMobileTab('map'));
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    const sheet = screen.getByTestId('map-sheet');
    fireEvent.pointerDown(sheet, { clientY: 600, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(sheet, { clientY: 300, pointerId: 1, pointerType: 'touch' });
    if (sheet.style.height) expect(sheet.className).not.toMatch(/\bmax-h-\[40vh\]/);
  });

  // Review on #666: a room is somewhere to look at, from anywhere.
  it('a room picked with the list open collapses the sheet too', () => {
    useAppStore.setState({ mobileTab: 'map', mapSheetState: 'half' } as never);
    render(<MapSheet />);
    act(() => useAppStore.getState().focusRoomByCode('Q01'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('a room picked from a card collapses the sheet to show the map', () => {
    useAppStore.setState({ mobileTab: 'map', mapSheetState: 'half' } as never);
    render(<MapSheet />);
    act(() => useAppStore.getState().focusSocietyPin(SKLUB));
    act(() => useAppStore.getState().focusRoomByCode('Q01'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });
});
