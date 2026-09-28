import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import { neutralSociety } from '../../../utils/societies/resolveSociety';
import type { MapEvent } from '../../../types/events';

const ev: MapEvent = {
  id: 'e1',
  title: 'Mine',
  url: '',
  date: '2026-07-10',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
};
describe('EventDetailCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      adminConsoleOpen: false,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      language: 'en',
    });
    vi.clearAllMocks();
  });

  // The card is a read-only preview: a society edits/deletes from the "Moje
  // akce" panel, never here (management stays in one place). Guard that no
  // authoring control leaks into the card, even for the society's own event.
  it('never renders edit/delete controls, even for an own event in the admin console', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
    });
    render(<EventDetailCard event={ev} />);
    expect(screen.queryByRole('button', { name: /delete|smazat/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit|upravit/i })).toBeNull();
  });

  // The composer's optional description, shown to students on the card both
  // trees render (the desktop DetailPanel and the phone's map sheet). Line
  // breaks the society typed are kept.
  it('shows the description the society wrote, line breaks kept', () => {
    render(<EventDetailCard event={{ ...ev, description: 'Sraz u Q.\nVezměte propisku.' }} />);
    const p = screen.getByText(/Sraz u Q\./);
    expect(p.textContent).toBe('Sraz u Q.\nVezměte propisku.');
    expect(p.className).toContain('whitespace-pre-line');
  });

  it('draws no description block when there is none', () => {
    const { container } = render(<EventDetailCard event={{ ...ev, description: null }} />);
    expect(container.querySelector('.whitespace-pre-line')).toBeNull();
  });

  it('links an off-campus venue to Google Maps at its coordinates (lat,lng)', () => {
    const offEvent: MapEvent = {
      ...ev,
      location: 'Bar, který neexistuje',
      coord: [16.6097, 49.1959],
    };
    render(<EventDetailCard event={offEvent} />);
    const link = screen.getByRole('link', { name: /Bar, který neexistuje/ });
    // Google Maps expects lat,lng; coord is stored [lng, lat].
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=49.1959,16.6097'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the human-readable room name, not the raw IS room code', () => {
    // Campus events persist only the IS-internal code ("BA39N1009"); the
    // hall name ("Q01") lives in rooms-index.json. The card must resolve it.
    const campusEvent: MapEvent = { ...ev, roomCode: 'BA39N1009', venueKind: 'campus' };
    render(<EventDetailCard event={campusEvent} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });

  // A society post's `url` is data from Supabase, not something the app
  // typed. A `javascript:` scheme handed straight to an <a href> would run
  // in the page the moment a student tapped "More info".
  it('renders no More-info link for a javascript: url', () => {
    const unsafeEvent: MapEvent = { ...ev, url: 'javascript:alert(1)' };
    render(<EventDetailCard event={unsafeEvent} />);
    expect(screen.queryByRole('link', { name: /more info/i })).toBeNull();
  });

  // A society that drops the pin by hand (map.orPickOnMap) publishes a
  // coordinate and NO location name. The card used to gate the whole venue
  // row on that name, so the student got no row at all: a pin on our map and
  // no way to hand it to a maps app. The coordinate is what makes the venue
  // openable, so the coordinate is what the row is gated on; the name only
  // chooses the label.
  it('links a hand-dropped pin (no location name) to Maps at its coordinates', () => {
    const dropped: MapEvent = { ...ev, location: null, coord: [16.6097, 49.1959] };
    render(<EventDetailCard event={dropped} />);
    const link = screen.getByRole('link', { name: /open in maps/i });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=49.1959,16.6097'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  // A campus event keeps its "fly to the room" button: that one navigates
  // INSIDE reIS, which is more useful than a map app for a lecture hall.
  it('prefers the room button over the Maps link for a campus event', () => {
    const campusEvent: MapEvent = {
      ...ev,
      roomCode: 'BA39N1009',
      venueKind: 'campus',
      location: null,
    };
    render(<EventDetailCard event={campusEvent} />);
    expect(screen.queryByRole('link', { name: /open in maps/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Q01/ })).toBeTruthy();
  });

  // Nothing to open: no coordinate, no name, no row — rather than a link
  // pointing at 0,0.
  it('renders no venue row when the event has neither a coordinate nor a name', () => {
    const nowhere: MapEvent = { ...ev, location: null, coord: null };
    render(<EventDetailCard event={nowhere} />);
    expect(screen.queryByRole('link', { name: /open in maps/i })).toBeNull();
  });

  it('still renders the More-info link for a plain https url', () => {
    const safeEvent: MapEvent = { ...ev, url: 'https://example.com/event' };
    render(<EventDetailCard event={safeEvent} />);
    expect(screen.getByRole('link', { name: /more info/i })).toHaveAttribute(
      'href',
      'https://example.com/event'
    );
  });

  // A TBA event has no room, no coordinate, and no url: everything a society
  // knows so far is "watch our Instagram". The venue line names the society
  // instead of a place, and the More-info button becomes the Instagram link.
  it('shows "Venue TBA by ESN" and links to Instagram for a TBA event with no url', () => {
    useAppStore.setState({
      societies: { esn: { ...neutralSociety('esn'), shortName: 'ESN', instagram: 'esnmendelubrno' } },
    });
    const tbaEvent: MapEvent = {
      ...ev,
      societyId: 'esn',
      url: '',
      location: null,
      coord: null,
      roomCode: null,
      venueKind: 'tba',
    };
    render(<EventDetailCard event={tbaEvent} />);
    expect(screen.getByText('Venue TBA by ESN')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /more on instagram/i });
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/esnmendelubrno/');
  });

  it('prefers the event url over Instagram when both are available', () => {
    useAppStore.setState({
      societies: { esn: { ...neutralSociety('esn'), shortName: 'ESN', instagram: 'esnmendelubrno' } },
    });
    const tbaEvent: MapEvent = {
      ...ev,
      societyId: 'esn',
      url: 'https://esn.cz/e',
      location: null,
      coord: null,
      roomCode: null,
      venueKind: 'tba',
    };
    render(<EventDetailCard event={tbaEvent} />);
    expect(screen.getByRole('link', { name: /more info/i })).toHaveAttribute(
      'href',
      'https://esn.cz/e'
    );
  });
  // A trip's card has to say how long it is: the start alone reads as a
  // one-evening event, and the list only says "ongoing until" once it began.
  it('shows the whole date range on one line for a multi-day event', () => {
    render(<EventDetailCard event={{ ...ev, date: '2026-11-23', endDate: '2026-11-29' }} />);
    const line = screen.getByText(/23.*29/);
    expect(line.textContent).toMatch(/Mon.*November 23.*Sun.*November 29/);
  });

  it('shows a single date for a one-day event', () => {
    render(<EventDetailCard event={{ ...ev, date: '2026-11-23', endDate: null, time: '18:00' }} />);
    expect(screen.getByText(/November 23/).textContent).toBe('Mon, November 23 · 18:00');
  });

  it('treats an end date equal to the start as a one-day event', () => {
    render(<EventDetailCard event={{ ...ev, date: '2026-11-23', endDate: '2026-11-23' }} />);
    expect(screen.getByText(/November 23/).textContent).toBe('Mon, November 23');
  });
});
