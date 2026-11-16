import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LibraryCard } from '../LibraryCard';
import { libraryOf } from '../libraryOf';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../../../../data/map/libraryRooms';
import type { Block } from '../../../../../../mobile/library/availability';
import type { RoomProperties } from '../../../../../../types/campusMap';

// Monday 16 November 2026, 09:30.
const NOW = new Date(2026, 10, 16, 9, 30);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Free all day on each of the next 14 days. */
function openBlocks(): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < 14; i++) {
    const d = iso(new Date(2026, 10, 16 + i));
    out.push({ status: 'free', start: `${d}T07:00`, end: `${d}T19:00` });
  }
  return out;
}

const ind1 = LIBRARY_ROOMS[0]!;
const ind2 = LIBRARY_ROOMS[1]!;
const team1 = LIBRARY_ROOMS[2]!;
const hourButtons = () =>
  screen.getAllByRole('button').filter((b) => /^\d\d:00/.test(b.textContent ?? ''));

beforeEach(() => {
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
    blocks: Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.featureId, openBlocks()])),
    status: 'ready',
    fetchedAt: Date.now(),
  });
});
afterEach(() => vi.useRealTimers());

describe('libraryOf', () => {
  it('knows the list, one room, and a bookable room reached another way', () => {
    expect(libraryOf({ kind: 'library' })).toEqual({ featureId: null });
    expect(libraryOf({ kind: 'library', featureId: ind1.featureId })).toEqual({
      featureId: ind1.featureId,
    });
    const tapped = { kind: 'room', room: { id: ind2.featureId } as RoomProperties } as const;
    expect(libraryOf(tapped)).toEqual({ featureId: ind2.featureId });
  });
  it('ignores every other room and selection', () => {
    expect(libraryOf({ kind: 'room', room: { id: 1 } as RoomProperties })).toBeNull();
    expect(libraryOf(null)).toBeNull();
  });
});

describe('LibraryCard list', () => {
  it('is one place: where it is, and all six rooms in one list, no A/IC chips', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Budova A, −1. patro')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Knihovna (A|IC)/ })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
  it('groups the rooms by how many people they hold, each under its one name', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    const groups = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(groups).toEqual(['Pro jednoho', 'Pro skupinu · 6 míst', 'Pro skupinu · 10 míst']);
    for (const name of [
      'Individuální 1',
      'Individuální 2',
      'Týmová 1',
      'Týmová 2',
      'IC levá',
      'IC pravá',
    ])
      expect(screen.getByText(name)).toBeTruthy();
  });
  it('names the first bookable hour of each room', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    // 09:30 plus the library's hour of notice: 11:00 is the first bookable start.
    expect(screen.getAllByText('od 11:00')).toHaveLength(6);
  });
  it('says nothing is known while the library answers, and calls no room free', () => {
    useLibraryStore.setState({ blocks: {}, status: 'loading', fetchedAt: null });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getAllByText('zjišťuji…')).toHaveLength(6);
    expect(screen.queryByText(/^od /)).toBeNull();
  });
  it('after the last bookable hour shows tomorrow, and says so', () => {
    vi.setSystemTime(new Date(2026, 10, 16, 19, 30));
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Na dnešek už rezervovat nejde');
    expect(screen.getByRole('status')).toHaveTextContent('úterý');
    expect(screen.getAllByText('od 07:00')).toHaveLength(6);
  });
  it('opens a room on tap', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(screen.getByText('Týmová 1'));
    expect(useAppStore.getState().mapSelection).toEqual({
      kind: 'library',
      featureId: team1.featureId,
    });
  });
  it('says so when the library cannot be reached', () => {
    useLibraryStore.setState({ status: 'offline', blocks: {} });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Zkontroluj připojení');
  });
});

describe('LibraryCard room', () => {
  it('shows five weekdays at once, starting today', () => {
    render(<LibraryCard view={{ featureId: ind1.featureId }} />);
    const chips = within(screen.getAllByRole('group')[0]!).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Dnes', 'Út 17', 'St 18', 'Čt 19', 'Pá 20']);
  });
  it('tells a past hour from a taken one, and marks the student’s class', () => {
    useAppStore.setState({
      schedule: {
        data: [{ date: '20261116', startTime: '13:00', endTime: '14:50' }],
        status: 'success',
      },
    } as never);
    useLibraryStore.setState({
      blocks: {
        [ind1.featureId]: [{ status: 'free', start: '2026-11-16T12:00', end: '2026-11-16T19:00' }],
      },
    });
    render(<LibraryCard view={{ featureId: ind1.featureId }} />);
    const h = (t: string) => hourButtons().find((b) => b.textContent?.startsWith(t))!;
    expect(h('08:00').className).not.toContain('line-through');
    expect(h('11:00').className).toContain('line-through');
    expect(h('13:00').textContent).toContain('výuka');
    expect((h('13:00') as HTMLButtonElement).disabled).toBe(false);
  });
  it('picks a stretch of hours and sends it to the confirm sheet in one go', () => {
    render(<LibraryCard view={{ featureId: ind1.featureId }} />);
    const h = (t: string) => hourButtons().find((b) => b.textContent?.startsWith(t))!;
    fireEvent.click(h('14:00'));
    fireEvent.click(h('15:00'));
    expect(screen.getByText(/14:00–16:00 · 2 h/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBook',
      featureId: ind1.featureId,
      day: '2026-11-16',
      from: 14,
      to: 16,
    });
  });
  it('does not jump to another day on its own: a full day says so and offers the next free hour', () => {
    useLibraryStore.setState({
      blocks: {
        [ind1.featureId]: [{ status: 'free', start: '2026-11-18T09:00', end: '2026-11-18T10:00' }],
      },
    });
    render(<LibraryCard view={{ featureId: ind1.featureId }} />);
    expect(screen.getByRole('button', { name: 'Dnes' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Tento den plno.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Nejbližší volno/ }));
    expect(screen.getByRole('button', { name: 'St 18' }).getAttribute('aria-pressed')).toBe('true');
  });
});
