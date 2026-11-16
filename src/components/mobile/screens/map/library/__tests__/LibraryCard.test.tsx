import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const wide = vi.hoisted(() => ({ value: false }));
vi.mock('../../../../../../hooks/ui/useWideViewport', () => ({
  useWideViewport: () => wide.value,
}));

import { LibraryCard } from '../LibraryCard';
import { libraryOf } from '../libraryOf';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../../../../data/map/libraryRooms';
import type { Block } from '../../../../../../mobile/library/availability';
import type { RoomProperties } from '../../../../../../types/campusMap';

// Monday 16 November 2026, 09:30. Tuesday 17 November is a public holiday.
const NOW = new Date(2026, 10, 16, 9, 30);
const day = (d: number, from: number, to: number): Block => ({
  status: 'free',
  start: `2026-11-${d}T${String(from).padStart(2, '0')}:00`,
  end: `2026-11-${d}T${String(to).padStart(2, '0')}:00`,
});
const [ind1, ind2, team1] = LIBRARY_ROOMS;
const hour = (t: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.startsWith(t) && /^\d\d:00/.test(t))!;

beforeEach(() => {
  wide.value = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useAppStore.setState({
    language: 'cz',
    mapSelection: null,
    mobileSheets: [],
    customEvents: [],
    schedule: { data: [], status: 'success' },
  } as never);
  useLibraryStore.setState({
    blocks: {
      [ind1!.featureId]: [day(16, 13, 19), day(18, 7, 19)],
      [ind2!.featureId]: [day(16, 14, 16)],
      [team1!.featureId]: [day(16, 14, 19)],
    },
    status: 'ready',
    fetchedAt: Date.now(),
    day: null,
    picked: [],
  });
});
afterEach(() => vi.useRealTimers());

describe('libraryOf', () => {
  it('knows the card, a chosen room, and a bookable room reached another way', () => {
    expect(libraryOf({ kind: 'library' })).toEqual({ featureId: null });
    expect(libraryOf({ kind: 'library', featureId: ind1!.featureId })).toEqual({
      featureId: ind1!.featureId,
    });
    const tapped = { kind: 'room', room: { id: ind2!.featureId } as RoomProperties } as const;
    expect(libraryOf(tapped)).toEqual({ featureId: ind2!.featureId });
    expect(libraryOf({ kind: 'room', room: { id: 1 } as RoomProperties })).toBeNull();
  });
});

describe('LibraryCard', () => {
  it('is time first: where it is, five days, the hours, and no room list until hours are picked', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Budova A, −1. patro')).toBeTruthy();
    const chips = within(screen.getAllByRole('group')[0]!).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Dnes', 'Út 17', 'St 18', 'Čt 19', 'Pá 20']);
    expect(screen.queryByRole('listitem')).toBeNull();
    // No explainers.
    expect(screen.queryByText(/uplynuly|obsazeno|Klepni/)).toBeNull();
  });

  it('shows the rooms free for the picked hours, smallest first', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(hour('14:00'));
    expect(screen.getByText('Volné 14:00–15:00')).toBeTruthy();
    expect(
      screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent)
    ).toEqual(['Individuální 1', 'Individuální 2', 'Týmová 1']);
    fireEvent.click(hour('15:00'));
    fireEvent.click(hour('16:00'));
    expect(screen.getByText('Volné 14:00–17:00')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('books a room on the phone through the confirm sheet, and shows the room on the map', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(hour('14:00'));
    fireEvent.click(hour('15:00'));
    fireEvent.click(screen.getByText('Týmová 1'));
    expect(useAppStore.getState().mapSelection).toEqual({
      kind: 'library',
      featureId: team1!.featureId,
    });
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBook',
      featureId: team1!.featureId,
      day: '2026-11-16',
      from: 14,
      to: 16,
    });
  });

  it('confirms on the iPad right under the room, not in a sheet', () => {
    wide.value = true;
    useLibraryStore.setState({ picked: [14] });
    render(<LibraryCard view={{ featureId: team1!.featureId }} flush />);
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    expect(screen.getByTestId('library-confirm')).toBeTruthy();
  });

  it('marks the student’s class on an hour, which can still be booked', () => {
    useAppStore.setState({
      schedule: {
        data: [{ date: '20261116', startTime: '15:00', endTime: '16:50' }],
        status: 'success',
      },
    } as never);
    render(<LibraryCard view={{ featureId: null }} />);
    expect(hour('15:00').textContent).toContain('výuka');
    expect((hour('15:00') as HTMLButtonElement).disabled).toBe(false);
  });

  it('says a public holiday is why the library is closed', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Út 17' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Den boje za svobodu a demokracii: knihovna má zavřeno.'
    );
  });

  it('after the last bookable hour opens on the next open day, skipping the holiday', () => {
    vi.setSystemTime(new Date(2026, 10, 16, 19, 30));
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('button', { name: 'St 18' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('says it is loading, and calls nothing free, before the library answers', () => {
    useLibraryStore.setState({ blocks: {}, status: 'loading', fetchedAt: null });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Načítám volné hodiny z knihovny…');
  });

  it('says so when the library cannot be reached', () => {
    useLibraryStore.setState({ status: 'offline', blocks: {} });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Zkontroluj připojení');
  });

  it('lists the student’s own bookings for the day on top, and never offers their hours again', () => {
    useAppStore.setState({
      customEvents: [
        {
          id: 'library:A1',
          title: 'Studovna v knihovně',
          date: '20261116',
          startTime: '14:00',
          endTime: '15:00',
          room: 'Individuální 1',
          libraryBooking: { featureId: ind1!.featureId, selfServiceIds: ['S1'] },
        },
      ],
    } as never);
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Máš rezervováno')).toBeTruthy();
    expect(screen.getByText('14:00–15:00')).toBeTruthy();
    fireEvent.click(hour('14:00'));
    const section = screen.getByText('Volné 14:00–15:00').closest('section')!;
    const free = within(section)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('span')?.textContent);
    expect(free).toEqual(['Individuální 2', 'Týmová 1']);
    fireEvent.click(screen.getByText('14:00–15:00'));
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBooking',
      eventId: 'library:A1',
    });
  });
});
