import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VenueMenuPage } from '../VenueMenu';
import { useAppStore } from '../../../store/useAppStore';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';

const venue = venueRowToPin(SKLUB_VENUE_ROW)!.venue!;
const [first, second] = venue.menu;

/**
 * The phone's menu page scrolls its chip row to the open category — once, when
 * it opens. Found in the release check of 11 November 2026: the row snapped
 * back to the open chip after every sideways swipe, because the ref doing the
 * scrolling was a new function on each render and React re-ran it each time.
 */
describe('VenueMenuPage chips', () => {
  const scrollIntoView = vi.fn();
  const original = Element.prototype.scrollIntoView;

  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('scrolls the open chip into view once, not on every render', () => {
    const { rerender } = render(
      <VenueMenuPage venue={venue} title="S-klub Pixie" sectionId={first!.id} />
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    rerender(<VenueMenuPage venue={venue} title="S-klub Pixie" sectionId={first!.id} />);
    rerender(<VenueMenuPage venue={venue} title="S-klub Pixie" sectionId={first!.id} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('scrolls again when another category opens', () => {
    const { rerender } = render(
      <VenueMenuPage venue={venue} title="S-klub Pixie" sectionId={first!.id} />
    );
    rerender(<VenueMenuPage venue={venue} title="S-klub Pixie" sectionId={second!.id} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
