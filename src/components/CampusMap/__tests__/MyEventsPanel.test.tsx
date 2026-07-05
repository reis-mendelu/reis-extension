import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MyEventsPanel } from '../MyEventsPanel';
import type { MapEvent } from '../../../types/events';

const mk = (id: string, date: string): MapEvent => ({
  id, title: `E-${id}`, url: '', date, endDate: null, time: null, location: null,
  imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2],
  roomCode: null, venueKind: 'offcampus', category: 'party',
});

describe('MyEventsPanel', () => {
  beforeEach(() => {
    // NOW is real; pick dates relative to today so the buckets are deterministic.
    const today = new Date(); const iso = (d: number) => {
      const t = new Date(today); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10);
    };
    useAppStore.setState({
      mapMode: 'society',
      language: 'en',
      // NOTE: the third fixture uses id 'old' rather than 'past' — a title of
      // "E-past" would collide with the "Past" section heading under a
      // case-insensitive /past/i text match (getByText would find two nodes).
      societyMapEvents: [mk('old', iso(-3)), mk('live', iso(2)), mk('sched', iso(30))],
    });
  });

  it('groups own events into Live / Scheduled / Past', () => {
    render(<MyEventsPanel />);
    expect(screen.getByText('E-live')).toBeInTheDocument();
    expect(screen.getByText('E-sched')).toBeInTheDocument();
    expect(screen.getByText('E-old')).toBeInTheDocument();
    // headings present
    expect(screen.getByText(/live now/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });
});
