import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminEventList } from '../AdminEventList';
import type { MapEvent } from '../../../types/events';

const mk = (id: string, date: string): MapEvent => ({
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

/**
 * The reported symptom, and where the fix landed.
 *
 * "Akce spolku se nearchivují s datem, jakmile proběhlo" — an event dated TODAY
 * stays in Live until midnight, so checking the same evening showed a finished
 * event as current. The buckets stay as they are: `isPastEvent` also drives the
 * PUBLIC window, and archiving at the start time would drop the event off the
 * student map at 19:01 while people are still arriving. The row says it instead.
 */
describe('AdminEventList — an event that has already happened today', () => {
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    const at23 = new Date();
    at23.setHours(23, 0, 0, 0);
    vi.setSystemTime(at23);
    useAppStore.setState({
      adminConsoleOpen: true,
      adminActiveAssociationId: 'supef',
      language: 'cz',
      societyMapEvents: [{ ...mk('tonight', todayIso()), title: 'Beánie PEF', time: '19:00' }],
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('marks it as proběhlo while it is still in the Live bucket', () => {
    render(<AdminEventList />);
    expect(screen.getByText('Beánie PEF')).toBeInTheDocument();
    expect(screen.getByText(/proběhlo/i)).toBeInTheDocument();
  });

  it('leaves an event later today unmarked', () => {
    useAppStore.setState({
      societyMapEvents: [{ ...mk('later', todayIso()), title: 'Koncert', time: '23:30' }],
    } as never);
    render(<AdminEventList />);
    expect(screen.getByText('Koncert')).toBeInTheDocument();
    expect(screen.queryByText(/proběhlo/i)).not.toBeInTheDocument();
  });
});
