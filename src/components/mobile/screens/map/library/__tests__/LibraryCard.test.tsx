import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

const wide = vi.hoisted(() => ({ value: false }));
vi.mock('../../../../../../hooks/ui/useWideViewport', () => ({
  useWideViewport: () => wide.value,
}));

// The app's gate: on in the phone and iPad apps, which is what these tests are.
vi.mock('../../../../../../mobile/library/transport', () => ({
  canBookLibrary: () => true,
  nativeBookingsHttp: vi.fn(),
}));

const booking = vi.hoisted(() => ({ bookAndRecord: vi.fn() }));
vi.mock('../../../../../../mobile/library/bookingActions', () => booking);

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
/** One cell of the grid: a room's name and the hour, as its accessible name says. */
const cell = (room: string, time: string) =>
  screen.getByRole('button', { name: `${room}, ${time}` });
const plus = (time: string) => screen.getByRole('button', { name: `Přidat hodinu ${time}` });
const bar = () => screen.queryByTestId('library-bar');

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
    room: null,
    noticeSeen: false,
    writing: false,
  });
  booking.bookAndRecord.mockReset();
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
  it('opens no card in a demo build', async () => {
    const demo = await import('../../../../../../errors/demoMode');
    const spy = vi.spyOn(demo, 'isDemoMode').mockReturnValue(true);
    expect(libraryOf({ kind: 'library' })).toBeNull();
    spy.mockRestore();
  });
});

describe('LibraryCard', () => {
  it('is a table: where it is, five days, a column per room, a row per hour still bookable', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Budova A, −1. patro')).toBeTruthy();
    const chips = within(screen.getAllByRole('group')[0]!).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Dnes', 'Út 17', 'St 18', 'Čt 19', 'Pá 20']);
    expect(screen.getByText('Ind. 1')).toBeTruthy();
    expect(screen.getByText('Tým 2')).toBeTruthy();
    // 09:30: 07–10 are over (10:00 starts inside the library's hour of notice) and not drawn.
    expect(screen.queryByText(/^(07|08|09|10):00/)).toBeNull();
    expect(screen.getByText('11:00')).toBeTruthy();
    // No bar, no legend and no instruction until something is picked.
    expect(bar()).toBeNull();
    expect(screen.queryByText(/Klepni|uplynuly|obsazeno/)).toBeNull();
  });

  it('draws only what can be tapped as a button: taken hours and rooms that did not answer are not', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    // Individuální 1 is free from 13:00; at 12:00 it is not.
    expect(screen.queryByRole('button', { name: 'Individuální 1, 12:00' })).toBeNull();
    expect(cell('Individuální 1', '13:00')).toBeTruthy();
    // Týmová 2 and the IC rooms were not read: "?", never offered.
    expect(screen.queryByRole('button', { name: /Týmová 2/ })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Některé studovny se nepodařilo načíst');
  });

  it('a tap picks one room and hour, shows it in the bar and offers a plus on each side', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Individuální 1', '14:00'));
    expect(within(bar()!).getByText('Individuální 1')).toBeTruthy();
    expect(within(bar()!).getByText('14:00–15:00 · 1 h')).toBeTruthy();
    expect(plus('13:00')).toBeTruthy();
    expect(plus('15:00')).toBeTruthy();
  });

  it('a plus adds that hour, an end hour takes it off, another room starts over', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Individuální 1', '14:00'));
    fireEvent.click(plus('15:00'));
    expect(within(bar()!).getByText('14:00–16:00 · 2 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Individuální 1, 15:00', pressed: true }));
    expect(within(bar()!).getByText('14:00–15:00 · 1 h')).toBeTruthy();
    fireEvent.click(cell('Týmová 1', '15:00'));
    expect(within(bar()!).getByText('Týmová 1')).toBeTruthy();
    expect(within(bar()!).getByText('15:00–16:00 · 1 h')).toBeTruthy();
    // Taking the last hour off leaves no pick, and no bar.
    fireEvent.click(screen.getByRole('button', { name: 'Týmová 1, 15:00', pressed: true }));
    expect(bar()).toBeNull();
  });

  it('closes the map in on the room when the pick moves into it', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(useAppStore.getState().mapSelection).toEqual({
      kind: 'library',
      featureId: team1!.featureId,
    });
  });

  it('offers no plus once the day’s allowance is used up by the pick', () => {
    // Three hours already booked today: one is left.
    useAppStore.setState({
      customEvents: [
        {
          id: 'library:A9',
          title: 'Studovna v knihovně',
          date: '20261116',
          startTime: '11:00',
          endTime: '14:00',
          room: 'Týmová 1',
          libraryBooking: { featureId: team1!.featureId, selfServiceIds: ['S9'] },
        },
      ],
    } as never);
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '15:00'));
    expect(within(bar()!).getByText('15:00–16:00 · 1 h')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Přidat hodinu/ })).toBeNull();
  });

  it('says a day is over instead of showing an empty table', () => {
    vi.setSystemTime(new Date(2026, 10, 16, 17, 30));
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));
    expect(screen.getByRole('status')).toHaveTextContent('Na tento den už nejde rezervovat.');
  });

  it('the first booking on a phone goes through the confirm sheet, with the data sentence', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(plus('15:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBook',
      featureId: team1!.featureId,
      day: '2026-11-16',
      from: 14,
      to: 16,
    });
    expect(booking.bookAndRecord).not.toHaveBeenCalled();
  });

  it('after that the check books straight away, with no sheet', async () => {
    booking.bookAndRecord.mockResolvedValue({ kind: 'ok' });
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(plus('15:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    await vi.waitFor(() => expect(booking.bookAndRecord).toHaveBeenCalledTimes(1));
    expect(booking.bookAndRecord).toHaveBeenCalledWith(
      expect.objectContaining({ room: team1, day: '2026-11-16', from: 14, to: 16 })
    );
    // The pick is spent once it is booked.
    await vi.waitFor(() => expect(bar()).toBeNull());
  });

  it('keeps the pick when the booking did not go through', async () => {
    booking.bookAndRecord.mockResolvedValue({ kind: 'taken' });
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    await vi.waitFor(() => expect(booking.bookAndRecord).toHaveBeenCalled());
    expect(bar()).toBeTruthy();
  });

  it('the “i” says what the library receives, any time', () => {
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(screen.queryByText(/Knihovna dostane/)).toBeNull();
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Co knihovna dostane' }));
    expect(screen.getByText(/Knihovna dostane tvé jméno/)).toBeTruthy();
  });

  it('the X clears the pick', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Zrušit výběr' }));
    expect(bar()).toBeNull();
    expect(useLibraryStore.getState().picked).toEqual([]);
  });

  it('on the iPad the first booking confirms inline in the bar, not in a sheet', () => {
    wide.value = true;
    render(<LibraryCard view={{ featureId: null }} flush />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    expect(screen.getByTestId('library-confirm')).toBeTruthy();
  });

  it('drops a pick whose cell was taken meanwhile', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(bar()).toBeTruthy();
    act(() => useLibraryStore.getState().markTaken(team1!.featureId, '2026-11-16', 14));
    expect(bar()).toBeNull();
  });

  it('marks the student’s class on an hour, which can still be booked', () => {
    useAppStore.setState({
      schedule: {
        data: [{ date: '20261116', startTime: '15:00', endTime: '16:50' }],
        status: 'success',
      },
    } as never);
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('15:00').parentElement!.textContent).toContain('výuka');
    expect(cell('Týmová 1', '15:00')).toBeTruthy();
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

  it('lists the student’s own bookings on top and shows their hours as theirs, never as free', () => {
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
    expect(screen.queryByRole('button', { name: 'Individuální 1, 14:00' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Individuální 1, 14:00' })).toBeTruthy();
    fireEvent.click(screen.getByText('14:00–15:00'));
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBooking',
      eventId: 'library:A1',
    });
  });

  it('drops a stored day once it has passed, and gives a later day its own chip', () => {
    useLibraryStore.setState({ day: '2026-11-13' });
    const { unmount } = render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('button', { name: 'Dnes' }).getAttribute('aria-pressed')).toBe('true');
    unmount();
    useLibraryStore.setState({ day: '2026-11-23' });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('button', { name: 'Po 23' }).getAttribute('aria-pressed')).toBe('true');
  });
});
