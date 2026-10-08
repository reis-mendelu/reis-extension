import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminEventList } from '../AdminEventList';
import type { MapEvent } from '../../../types/events';

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

// The reason to open the console after publishing: did anyone see it, open
// it, follow its link? Three numbers per event, each once per device, read
// from event_signals (spec 2026-10-08).
describe('AdminEventList — seen, opened and link per event', () => {
  beforeEach(() => {
    const dates = { old: iso(-3), live: iso(2), far: iso(30) };
    useAppStore.setState({
      adminConsoleOpen: true,
      adminActiveAssociationId: 'supef',
      language: 'en',
      composerOpen: false,
      societyMapEvents: [ev('old', dates.old), ev('live', dates.live), ev('far', dates.far)],
      societyPosts: [],
      societyEventSignals: {
        old: { seen: 13, opened: 8, linkTaps: 1 },
        live: { seen: 60, opened: 29, linkTaps: 4 },
        far: { seen: 0, opened: 0, linkTaps: 0 },
      },
    });
  });

  const rowOf = (title: string) => screen.getByText(title).closest('button') as HTMLElement;

  it('shows a live event its three numbers', () => {
    render(<AdminEventList />);
    const live = rowOf('E-live');
    expect(within(live).getByText('60 seen')).toBeInTheDocument();
    expect(within(live).getByText('29 opened')).toBeInTheDocument();
    expect(within(live).getByText('4 link taps')).toBeInTheDocument();
  });

  it('keeps the final numbers on a past event', () => {
    render(<AdminEventList />);
    expect(within(rowOf('E-old')).getByText('13 seen')).toBeInTheDocument();
  });

  it('says what the numbers count', () => {
    render(<AdminEventList />);
    expect(screen.getByText(/device once/i)).toBeInTheDocument();
  });

  it('shows no numbers, and no note, before they have loaded', () => {
    useAppStore.setState({ societyEventSignals: {} });
    render(<AdminEventList />);
    expect(within(rowOf('E-live')).queryByText(/seen/)).toBeNull();
    expect(screen.queryByText(/device once/i)).toBeNull();
  });
});
