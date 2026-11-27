import { screen } from '@testing-library/react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../../../../data/map/libraryRooms';
import type { Block } from '../../../../../../mobile/library/availability';

// Monday 16 November 2026, 09:30. Tuesday 17 November is a public holiday.
export const NOW = new Date('2026-11-16T09:30:00+01:00');
export const day = (d: number, from: number, to: number): Block => ({
  status: 'free',
  start: `2026-11-${d}T${String(from).padStart(2, '0')}:00`,
  end: `2026-11-${d}T${String(to).padStart(2, '0')}:00`,
});
export const [ind1, ind2, team1] = LIBRARY_ROOMS;
/** One cell of the grid: a room's name and the hour, as its accessible name says. */
export const cell = (room: string, time: string) =>
  screen.getByRole('button', { name: `${room}, ${time}` });
export const plus = (time: string) => screen.getByRole('button', { name: `Přidat hodinu ${time}` });
export const bar = () => screen.queryByTestId('library-bar');

/** The card's starting state: three rooms answered, nothing picked, nothing booked. */
export function seedCard() {
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
}
