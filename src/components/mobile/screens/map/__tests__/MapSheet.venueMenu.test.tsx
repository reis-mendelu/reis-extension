import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MapSheet } from '../MapSheet';
import { useAppStore } from '../../../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../../../data/societies';
import { venueRowToPin } from '../../../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../../../test/fixtures/sklubVenueRow';

vi.mock('../../../../../hooks/ui/useWideViewport', () => ({ useWideViewport: () => false }));

const sklub = venueRowToPin(SKLUB_VENUE_ROW)!;

/**
 * One back button on a phone's menu page. The card used to draw its own ‹ under
 * the sheet's "‹ Akce", and the thumb went to the top one, which closed the
 * card instead of returning to it (Dominik, 2026-11-09).
 */
describe('MapSheet — a venue menu category', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.getState().suggestRoute(null);
    useAppStore.setState({
      language: 'cz',
      now: new Date('2026-11-09T12:30:00Z'),
      mapSheetState: 'half',
      mapEvents: [],
      mapEventsLoaded: true,
      societies: {
        ...BUNDLED_SOCIETIES,
        sklub: {
          ...BUNDLED_SOCIETIES.reis!,
          id: 'sklub',
          name: 'S-klub Pixie',
          shortName: 'S-klub',
        },
      },
    } as never);
    useAppStore.getState().selectSocietyPin(sklub);
  });
  afterEach(cleanup);

  it('names the venue in the header and goes back to its card', () => {
    useAppStore.getState().setVenueMenuSection('coffee');
    render(<MapSheet />);
    expect(screen.getByTestId('venue-menu-page')).toBeTruthy();
    const back = screen.getByRole('button', { name: 'Zpět na S-klub Pixie' });
    expect(back.textContent).toBe('S-klub Pixie');
    fireEvent.click(back);
    expect(useAppStore.getState().venueMenuSection).toBeNull();
    expect(useAppStore.getState().mapSelection?.kind).toBe('societyPin');
    expect(screen.getByTestId('venue-card')).toBeTruthy();
  });

  it('draws no second back button inside the page', () => {
    useAppStore.getState().setVenueMenuSection('coffee');
    render(<MapSheet />);
    const page = screen.getByTestId('venue-menu-page');
    // Its only buttons are the category chips (cubic on #662: an aria-label
    // query could not catch an unlabelled arrow).
    expect(within(page).getAllByRole('button')).toHaveLength(sklub.venue!.menu.length);
  });

  it('from the card itself, Back still closes it', () => {
    render(<MapSheet />);
    fireEvent.click(screen.getByRole('button', { name: /^Akce$/ }));
    expect(useAppStore.getState().mapSelection).toBeNull();
  });
});
