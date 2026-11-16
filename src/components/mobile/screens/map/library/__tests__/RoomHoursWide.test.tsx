import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../../../../hooks/ui/useWideViewport', () => ({ useWideViewport: () => true }));

import { LibraryCard } from '../LibraryCard';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { LIBRARY_ROOMS } from '../../../../../../data/map/libraryRooms';

const ind1 = LIBRARY_ROOMS[0]!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 9, 30));
  useAppStore.setState({
    language: 'cz',
    mobileSheets: [],
    customEvents: [],
    schedule: { data: [], status: 'success' },
  } as never);
  useLibraryStore.setState({
    blocks: {
      [ind1.featureId]: [{ status: 'free', start: '2026-11-16T07:00', end: '2026-11-16T19:00' }],
    },
    status: 'ready',
    fetchedAt: Date.now(),
  });
});
afterEach(() => vi.useRealTimers());

describe('RoomHours on the iPad', () => {
  it('confirms inside the side panel, next to the hours, not in a full-width sheet', () => {
    render(<LibraryCard view={{ featureId: ind1.featureId }} flush />);
    fireEvent.click(screen.getByRole('button', { name: '14:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    expect(screen.getByTestId('library-confirm')).toBeTruthy();
    expect(screen.getByText('Rezervovat studovnu?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(screen.queryByTestId('library-confirm')).toBeNull();
  });
});
