import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['pef'], isLoading: false }),
}));

import { MapEventsSection } from '../MapEventsSection';
import { useAppStore } from '../../../store/useAppStore';
import type { MapEvent } from '../../../types/events';

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ev = (id: string, societyId: string, title: string): MapEvent =>
  ({
    id,
    societyId,
    title,
    url: '',
    date: iso(2),
    endDate: null,
    time: '19:00',
    location: 'Zemědělská 1',
    imageUrl: null,
    organizerKey: 'pef',
    coord: [16.6, 49.2],
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
  }) as MapEvent;

/**
 * The society filter chips leave the phone's Akce sheet.
 *
 * Nine chips ("Vše ESN SUPEF AU FRRMS AF LDF ZF EY reIS") in a horizontally
 * scrolling row above a list that is usually two or three events long: the
 * filter cost more room than the thing it filtered.
 *
 * Hidden, not deleted — the desktop side panel keeps it, where the row has
 * space and the list is longer.
 *
 * The important half is the second test. `eventFilter` is shared store state,
 * so a filter set on the desktop would still be narrowing the phone's list with
 * no control left to clear it — events would simply be missing. Hiding the
 * chips has to mean showing everything.
 */
describe('MapEventsSection without the filter', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapEvents: [ev('a', 'esn', 'Beánie PEF'), ev('b', 'supef', 'Koncert na kampusu')],
      mapSelection: null,
      eventFilter: 'all',
    } as never);
  });

  it('renders no chips when the filter is hidden', () => {
    render(<MapEventsSection showFilter={false} />);
    expect(screen.queryByRole('button', { name: 'Vše' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ESN' })).not.toBeInTheDocument();
  });

  it('ignores a stored filter, so no event is hidden without a way back', () => {
    useAppStore.setState({ eventFilter: 'esn' } as never);
    render(<MapEventsSection showFilter={false} />);
    expect(screen.getByText('Beánie PEF')).toBeInTheDocument();
    expect(screen.getByText('Koncert na kampusu')).toBeInTheDocument();
  });

  it('still offers the chips where they are wanted', () => {
    render(<MapEventsSection />);
    expect(screen.getByRole('button', { name: 'Vše' })).toBeInTheDocument();
  });

  it('still honours the filter when the chips are shown', () => {
    useAppStore.setState({ eventFilter: 'esn' } as never);
    render(<MapEventsSection />);
    expect(screen.getByText('Beánie PEF')).toBeInTheDocument();
    expect(screen.queryByText('Koncert na kampusu')).not.toBeInTheDocument();
  });
});
