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
 * The society filter chips are gone from every surface.
 *
 * They were hidden on the phone first ("nine chips above a list that is usually
 * two or three events long"), and the desktop side panel kept them. The desktop
 * row was no better: nine names, wrapped over two lines, above a list a student
 * reads top to bottom anyway. So the control leaves rather than moves, and with
 * it the `eventFilter` store state that persisted a choice across surfaces and
 * twice made pins and rows disagree about what was on the map.
 *
 * Deleted, not defaulted to 'all': state nothing can set is state that will be
 * read wrong later.
 */
describe('MapEventsSection', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapEvents: [ev('a', 'esn', 'Beánie PEF'), ev('b', 'supef', 'Koncert na kampusu')],
      mapSelection: null,
    } as never);
  });

  it('renders no society chips', () => {
    render(<MapEventsSection />);
    expect(screen.queryByRole('button', { name: 'Vše' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ESN' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SUPEF' })).not.toBeInTheDocument();
  });

  it('lists every society’s events, because nothing narrows them any more', () => {
    render(<MapEventsSection />);
    expect(screen.getByText('Beánie PEF')).toBeInTheDocument();
    expect(screen.getByText('Koncert na kampusu')).toBeInTheDocument();
  });
});
