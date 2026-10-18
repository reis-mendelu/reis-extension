import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventReachTable } from '../EventReachTable';
import type { EventReach, EventDailyPoint } from '../../../api/featureStats';

const ev = (o: Partial<EventReach> & { id: string }): EventReach => ({
  title: o.id,
  societyId: 'supef',
  kind: 'event',
  views: 0,
  clicks: 0,
  mapViews: 0,
  ...o,
});

const REACH: EventReach[] = [
  ev({ id: 'a', title: 'Ples PEF', views: 5253, clicks: 247, mapViews: 199 }),
  ev({ id: 'b', title: 'Deskovky', societyId: 'esn', views: 0, clicks: 0, mapViews: 12 }),
  ev({
    id: 'n',
    title: 'Hledáš bydlení?',
    societyId: 'reis',
    kind: 'notice',
    views: 761,
    clicks: 143,
    mapViews: 11,
  }),
];
const DAILY: EventDailyPoint[] = [{ day: '2026-09-21', eventId: 'a', views: 31 }];

const seed = (reach = REACH, daily = DAILY) =>
  useAppStore.setState({
    language: 'cz',
    adminFeatureStats: {
      byFeature: [],
      daily: [],
      topEvents: [],
      eventDaily: daily,
      eventReach: reach,
    },
  } as never);

const rowOf = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('EventReachTable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22));
    seed();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('puts Novinky views, clicks and map opens on ONE row per event', () => {
    render(<EventReachTable />);

    const row = rowOf('Ples PEF');
    expect(within(row).getByText('5 253')).toBeInTheDocument();
    expect(within(row).getByText('247')).toBeInTheDocument();
    expect(within(row).getByText('199')).toBeInTheDocument();
  });

  it('shows clicks per view as a percentage', () => {
    render(<EventReachTable />);

    expect(within(rowOf('Ples PEF')).getByText('4,7 %')).toBeInTheDocument();
  });

  // Dividing by zero would print Infinity or NaN; no views means no ratio.
  it('shows a dash instead of a ratio when nobody saw it in Novinky', () => {
    render(<EventReachTable />);

    const row = rowOf('Deskovky');
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  // Map opens on a notice predate the event/notice split; a notice has no pin.
  it('shows no map figure for a notice', () => {
    render(<EventReachTable />);

    const row = rowOf('Hledáš bydlení?');
    expect(within(row).queryByText('11')).not.toBeInTheDocument();
    expect(within(row).getByText('761')).toBeInTheDocument();
  });

  it('names the society on each row', () => {
    render(<EventReachTable />);

    expect(within(rowOf('Deskovky')).getByText(/ESN/i)).toBeInTheDocument();
  });

  // Counts of opens, never of people — the label has to say so.
  it('says the numbers are opens, not people', () => {
    render(<EventReachTable />);

    expect(screen.getByText(/ne lidí/)).toBeInTheDocument();
  });

  it('draws the map-open trend of the row you pick, when it has one', () => {
    render(<EventReachTable />);

    fireEvent.click(within(rowOf('Ples PEF')).getByRole('button'));

    expect(screen.getByRole('img', { name: /Ples PEF.*celkem 31 otevření/ })).toBeInTheDocument();
  });

  it('shows the empty state when no event has any activity', () => {
    seed([]);
    render(<EventReachTable />);

    expect(screen.getByText('Zatím žádná data.')).toBeInTheDocument();
  });
});
