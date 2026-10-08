import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventRow } from '../EventRow';
import { neutralSociety } from '../../../utils/societies/resolveSociety';
import type { MapEvent } from '../../../types/events';

const ev: MapEvent = {
  id: 'e1',
  title: 'Spring Party',
  url: '',
  date: '2026-07-10',
  endDate: null,
  time: '20:00',
  location: 'Klub Mandarin',
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
};
const t = (k: string, p?: Record<string, string | number>) => (p ? `${k} ${JSON.stringify(p)}` : k);

describe('EventRow', () => {
  it("shows the event's own emoji in the tile", () => {
    render(
      <EventRow
        event={{ ...ev, imageUrl: null, emoji: '1f3d3' }}
        locale="cs-CZ"
        t={t}
        selected={false}
        onClick={() => {}}
      />
    );
    expect(document.querySelector('img[src="/emoji/1f3d3.svg"]')).toBeTruthy();
  });

  beforeEach(() => {
    useAppStore.setState({ societies: { esn: { ...neutralSociety('esn'), shortName: 'ESN' } } });
  });

  it('renders the category emoji, title, and default day subline + location', () => {
    render(<EventRow event={ev} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />);
    expect(screen.getByText('Spring Party')).toBeInTheDocument();
    expect(screen.getByText('Klub Mandarin')).toBeInTheDocument();
    const img = document.querySelector('img[src="/emoji/1f389.svg"]'); // 🎉 party
    expect(img).toBeTruthy();
  });

  // An event whose pin was dropped by hand has a coordinate and no name. The
  // row used to print nothing at all there, so in a list next to a named venue
  // it read as an event with no place — while the detail card had a working
  // "open in Maps" link all along. A generic label restores the line.
  it('labels a hand-dropped venue instead of dropping the line', () => {
    const dropped: MapEvent = { ...ev, location: null };
    render(<EventRow event={dropped} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />);
    expect(screen.getByText('map.venueOnMap')).toBeInTheDocument();
  });

  // Nothing to say: an event with neither a name nor a coordinate keeps the
  // compact two-line row it has always had.
  it('renders no venue line when there is neither a name nor a coordinate', () => {
    const nowhere: MapEvent = { ...ev, location: null, coord: null };
    render(<EventRow event={nowhere} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />);
    expect(screen.queryByText('map.venueOnMap')).toBeNull();
  });

  it('uses the subline override when provided', () => {
    render(
      <EventRow
        event={ev}
        locale="cs-CZ"
        t={t}
        selected={false}
        onClick={() => {}}
        subline="zveřejní se 1. čvc"
      />
    );
    expect(screen.getByText('zveřejní se 1. čvc')).toBeInTheDocument();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<EventRow event={ev} locale="cs-CZ" t={t} selected onClick={onClick} />);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  // Imported from a semester list: no room, no coordinate, no name — the
  // society just hasn't said where yet. "Místo upřesní SUPEF" on every row
  // said nothing the student could use; the row's link to the society's
  // Instagram is where the place gets announced, so the row stays quiet.
  it('says nothing about the place for a TBA event', () => {
    const tbaEvent: MapEvent = {
      ...ev,
      societyId: 'esn',
      location: null,
      coord: null,
      roomCode: null,
      venueKind: 'tba',
    };
    const { container } = render(
      <EventRow event={tbaEvent} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />
    );
    expect(screen.queryByText(/map\.venueTba/)).toBeNull();
    expect(container.querySelector('.lucide-map-pin')).toBeNull();
  });

  // A blank location is no location: it used to draw a pin beside nothing.
  it('treats a whitespace-only location as none', () => {
    const tbaEvent: MapEvent = {
      ...ev,
      societyId: 'esn',
      location: '   ',
      coord: null,
      roomCode: null,
      venueKind: 'tba',
    };
    const { container } = render(
      <EventRow event={tbaEvent} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />
    );
    expect(container.querySelector('.lucide-map-pin')).toBeNull();
  });
  // The list keeps a multi-day trip until its last day. Labelled by its start,
  // a trip two days in read as a weekday ahead.
  it('labels a trip that has already started as ongoing until its end', () => {
    const iso = (days: number) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const trip: MapEvent = { ...ev, date: iso(-2), endDate: iso(3), time: null };
    render(<EventRow event={trip} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />);
    expect(screen.getByText(/^map\.ongoingUntil /)).toBeInTheDocument();
  });
});
