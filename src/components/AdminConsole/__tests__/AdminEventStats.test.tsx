import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminEventList } from '../AdminEventList';
import type { MapEvent } from '../../../types/events';
import type { SpolkyEventRow } from '../../../api/societyPosts';

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn().mockResolvedValue({}) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const iso = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

const ev = (id: string, date: string): MapEvent => ({
  id,
  title: `E-${id}`,
  url: '',
  date,
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
});

const row = (id: string, date: string, views: number, clicks: number): SpolkyEventRow => ({
  id,
  association_id: 'supef',
  title: `E-${id}`,
  body: null,
  category: 'party',
  date,
  end_date: null,
  time: null,
  venue_kind: 'offcampus',
  room_code: null,
  coord_lng: 16.6,
  coord_lat: 49.2,
  location: null,
  url: null,
  created_by: null,
  visible_from: null,
  subscribers_only: false,
  view_count: views,
  click_count: clicks,
});

// The society's reason to open the console after publishing: did anyone see it?
// The numbers come from the society's own `spolky_events` rows, which the
// console already loads under the society's session.
describe('AdminEventList — views and clicks per event', () => {
  beforeEach(() => {
    const dates = { old: iso(-3), live: iso(2), sched: iso(30) };
    useAppStore.setState({
      adminConsoleOpen: true,
      adminActiveAssociationId: 'supef',
      language: 'en',
      composerOpen: false,
      societyMapEvents: [ev('old', dates.old), ev('live', dates.live), ev('sched', dates.sched)],
      societyPosts: [
        row('old', dates.old, 13, 8),
        row('live', dates.live, 60, 29),
        row('sched', dates.sched, 0, 0),
      ],
    });
  });

  const rowOf = (title: string) => screen.getByText(title).closest('button') as HTMLElement;

  it('shows a live event its views and clicks', () => {
    render(<AdminEventList />);
    const live = rowOf('E-live');
    expect(within(live).getByText('60 views')).toBeInTheDocument();
    expect(within(live).getByText('29 clicks')).toBeInTheDocument();
  });

  it('keeps the final numbers on a past event', () => {
    render(<AdminEventList />);
    const old = rowOf('E-old');
    expect(within(old).getByText('13 views')).toBeInTheDocument();
    expect(within(old).getByText('8 clicks')).toBeInTheDocument();
  });

  // "Scheduled" is off the MAP only. Novinky lists every event from today on
  // (fetchNotifications: date >= today, visible_from null on every prod row),
  // so a scheduled event collects real views — the earliest numbers a society
  // gets, and the ones it most wants.
  it('shows a scheduled event its numbers too', () => {
    useAppStore.setState({
      societyPosts: [row('sched', useAppStore.getState().societyMapEvents[2]!.date, 7, 2)],
    });
    render(<AdminEventList />);
    const sched = rowOf('E-sched');
    expect(within(sched).getByText('7 views')).toBeInTheDocument();
    expect(within(sched).getByText('2 clicks')).toBeInTheDocument();
  });

  it('says one view is one device, not one person', () => {
    render(<AdminEventList />);
    expect(screen.getByText(/device/i)).toBeInTheDocument();
  });

  it('shows no note when no row carries both counters', () => {
    useAppStore.setState({
      societyPosts: [{ ...row('live', iso(2), 60, 0), click_count: undefined }],
    });
    render(<AdminEventList />);
    expect(within(rowOf('E-live')).queryByText(/views/)).toBeNull();
    expect(screen.queryByText(/device/i)).toBeNull();
  });

  it('shows no numbers when the row carries none (dev store, stale cache)', () => {
    useAppStore.setState({ societyPosts: [] });
    render(<AdminEventList />);
    expect(within(rowOf('E-live')).queryByText(/views/)).toBeNull();
    expect(screen.queryByText(/device/i)).toBeNull();
  });
});
