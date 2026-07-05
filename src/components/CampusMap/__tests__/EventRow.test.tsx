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
