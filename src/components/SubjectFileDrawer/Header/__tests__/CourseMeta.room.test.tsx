import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson } from '../../../../test/fixtures/lesson';
import { CourseMeta } from '../CourseMeta';

/**
 * The desktop subject drawer used to decide with `lesson.room.startsWith('Q')`
 * — building Q is PEF. A PEF student got a hoverable room with a floor-plan
 * card behind it; everyone else got a plain button that called the same
 * lookup and, because that lookup ignored nicknames, did nothing at all.
 *
 * The room being findable is the only thing that should decide this now.
 */
const focus = vi.fn();

beforeEach(() => {
  focus.mockClear();
  useAppStore.setState({ language: 'cz', focusRoomByCode: focus });
});

const renderRoom = (room: string) =>
  render(
    <CourseMeta lesson={makeLesson({ room })} courseInfo={undefined} isSearchContext={false} />
  );

describe('CourseMeta room control', () => {
  it.each([
    ['Q01', 'a PEF hall, which already worked'],
    ['A01', 'a hall known to the index only by its nickname'],
    ['Aula', 'a hall whose nickname is a word, not a code'],
  ])('offers %s as a button (%s)', (room) => {
    renderRoom(room);
    const btn = screen.getByRole('button', { name: room });
    fireEvent.click(btn);
    expect(focus).toHaveBeenCalledWith(room);
  });

  // No floor plan, but the map can show the building (T) or campus (Lednice)
  // — focusRoomByCode takes the full string, campus and all, to find it.
  it.each(['T18', 'ZFAC1 (Led)'])('offers %s, which has only a building, as a button', (room) => {
    renderRoom(room);
    fireEvent.click(screen.getByRole('button', { name: room }));
    expect(focus).toHaveBeenCalledWith(room);
  });

  it('shows a room the map cannot place at all as plain text rather than a dead button', () => {
    // IS files this room under two places at once, so it gets none; a button would be a
    // promise reIS cannot keep.
    renderRoom('Lesní škola Jezírko (ŠLP)');
    expect(screen.getByText('Lesní škola Jezírko (ŠLP)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lesní škola Jezírko (ŠLP)' })).toBeNull();
  });

  it('shows a virtual room as plain text too', () => {
    renderRoom('B Virtuální 6');
    expect(screen.queryByRole('button', { name: 'B Virtuální 6' })).toBeNull();
  });
});
