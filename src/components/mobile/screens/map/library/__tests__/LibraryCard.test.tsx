import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryCard } from '../LibraryCard';
import { libraryOf } from '../libraryOf';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../../../../data/map/libraryRooms';
import type { Block } from '../../../../../../mobile/library/availability';
import type { RoomProperties } from '../../../../../../types/campusMap';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Free all day on each of the next 14 days, so a weekday is always among them. */
function openBlocks(): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < 14; i++) {
    const d = iso(new Date(Date.now() + i * 86_400_000));
    out.push({ status: 'free', start: `${d}T07:00`, end: `${d}T19:00` });
  }
  return out;
}

const ind1 = LIBRARY_ROOMS[0]!;
const ind2 = LIBRARY_ROOMS[1]!;

beforeEach(() => {
  useAppStore.setState({ language: 'cz', mapSelection: null, mobileSheets: [] } as never);
  useLibraryStore.setState({
    blocks: Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.featureId, openBlocks()])),
    status: 'ready',
    fetchedAt: Date.now(),
  });
});

describe('libraryOf', () => {
  it('knows the list, one room, and a bookable room tapped on the plan', () => {
    expect(libraryOf({ kind: 'library' })).toEqual({ featureId: null, group: 'main' });
    expect(libraryOf({ kind: 'library', group: 'ic' })).toEqual({ featureId: null, group: 'ic' });
    expect(libraryOf({ kind: 'library', featureId: ind1.featureId })).toEqual({
      featureId: ind1.featureId,
      group: 'main',
    });
    const tapped = { kind: 'room', room: { id: ind2.featureId } as RoomProperties } as const;
    expect(libraryOf(tapped)).toEqual({ featureId: ind2.featureId, group: 'main' });
  });
  it('ignores every other room and selection', () => {
    expect(libraryOf({ kind: 'room', room: { id: 1 } as RoomProperties })).toBeNull();
    expect(libraryOf(null)).toBeNull();
  });
});

describe('LibraryCard list', () => {
  it('lists the four library rooms under the Knihovna A chip, the IC rooms under the other', () => {
    render(<LibraryCard view={{ featureId: null, group: 'main' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(2 + 4);
    fireEvent.click(screen.getByRole('button', { name: 'Knihovna IC' }));
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'library', group: 'ic' });
  });
  it('spells each room out and says how many people it holds', () => {
    render(<LibraryCard view={{ featureId: null, group: 'main' }} />);
    expect(screen.getByText('Individuální 1')).toBeTruthy();
    expect(screen.getByText('Týmová 1')).toBeTruthy();
    expect(screen.getByText('10 míst')).toBeTruthy();
    expect(screen.getByText('6 míst')).toBeTruthy();
    expect(screen.getAllByText('1 místo')).toHaveLength(2);
  });
  it('says that tapping a room books it, and that the hours are for today', () => {
    render(<LibraryCard view={{ featureId: null, group: 'main' }} />);
    expect(screen.getByText('Klepni na studovnu a vyber hodinu k rezervaci.')).toBeTruthy();
    expect(screen.getAllByText(/^dnes (volné od|plno)/).length).toBe(4);
  });
  it('opens a room on tap', () => {
    render(<LibraryCard view={{ featureId: null, group: 'main' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Týmová studovna 1' }));
    expect(useAppStore.getState().mapSelection).toEqual({
      kind: 'library',
      featureId: LIBRARY_ROOMS[2]!.featureId,
      group: 'main',
    });
  });
  it('says so when the library cannot be reached', () => {
    useLibraryStore.setState({ status: 'offline', blocks: {} });
    render(<LibraryCard view={{ featureId: null, group: 'main' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Zkontroluj připojení');
  });
});

describe('LibraryCard room', () => {
  it('offers the free hours and opens the confirm sheet for the one tapped', () => {
    render(<LibraryCard view={{ featureId: ind1.featureId, group: 'main' }} />);
    const free = screen.getAllByRole('button').filter((b) => /^\d\d:00$/.test(b.textContent ?? ''));
    const open = free.find((b) => !(b as HTMLButtonElement).disabled);
    expect(open).toBeDefined();
    fireEvent.click(open!);
    const sheet = useAppStore.getState().mobileSheets[0];
    expect(sheet).toMatchObject({ kind: 'libraryBook', featureId: ind1.featureId });
  });
  it('shows nothing bookable for a room with no free hour', () => {
    useLibraryStore.setState({ blocks: { [ind1.featureId]: [] } });
    render(<LibraryCard view={{ featureId: ind1.featureId, group: 'main' }} />);
    const hours = screen
      .getAllByRole('button')
      .filter((b) => /^\d\d:00$/.test(b.textContent ?? ''));
    expect(hours.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
