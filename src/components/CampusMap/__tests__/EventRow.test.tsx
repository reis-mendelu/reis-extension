import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventRow } from '../EventRow';
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
const t = (k: string) => k;

describe('EventRow', () => {
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
});
