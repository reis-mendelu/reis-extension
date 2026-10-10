import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminEventList } from '../AdminEventList';
import type { MapEvent } from '../../../types/events';

// A delete in flight disables its row. Split from AdminEventList.test.tsx to
// keep both short. Czech strings: the suite sets language 'cz'.

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn() }));
import { deletePost } from '../../../api/societyPosts';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mk = (id: string, title: string): MapEvent => ({
  id,
  title,
  url: '',
  date: '2099-07-10',
  endDate: null,
  time: '20:00',
  location: 'Klub',
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
});

/** A deletePost the test resolves by hand. */
const pendingDelete = () => {
  let done!: (v: { error?: string }) => void;
  vi.mocked(deletePost).mockReturnValueOnce(new Promise((r) => (done = r)) as never);
  return () => done({});
};

// EventRow's outer element: the flex row holding the body and the actions.
const rowOf = (title: string) =>
  within(screen.getByText(title).closest('div.items-stretch') as HTMLElement);
const startDelete = (title: string) => {
  fireEvent.click(rowOf(title).getByRole('button', { name: 'Smazat' }));
  fireEvent.click(rowOf(title).getByRole('button', { name: 'Opravdu smazat?' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    language: 'cz',
    adminConsoleOpen: true,
    adminActiveAssociationId: 'supef',
    composerOpen: false,
    societyMapEvents: [mk('e1', 'Spring Party'), mk('e2', 'Deskovky')],
    loadSocietyPosts: vi.fn(async () => {}),
    reloadMapEvents: vi.fn(async () => {}),
    clearMapSelection: vi.fn(),
  });
});

describe('AdminEventList — a delete in flight', () => {
  it('disables cancel too, so the row cannot be re-armed mid-request', async () => {
    const finish = pendingDelete();
    render(<AdminEventList />);
    startDelete('Spring Party');
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
    expect(rowOf('Spring Party').getByRole('button', { name: 'Zrušit' })).toBeDisabled();
    expect(rowOf('Spring Party').getByRole('button', { name: 'Opravdu smazat?' })).toBeDisabled();
    await act(async () => finish());
  });

  it('ignores a click on the row body while its delete is in flight', async () => {
    const focusEventById = vi.fn();
    useAppStore.setState({ focusEventById });
    const finish = pendingDelete();
    render(<AdminEventList />);
    startDelete('Spring Party');
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
    fireEvent.click(screen.getByText('Spring Party'));
    expect(focusEventById).not.toHaveBeenCalled();
    await act(async () => finish());
  });

  it('clears a selection made on the deleted event after the delete started', async () => {
    const finish = pendingDelete();
    render(<AdminEventList />);
    startDelete('Spring Party');
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
    // Selected some other way (a map pin) while the request was in flight.
    act(() =>
      useAppStore.setState({
        mapSelection: { kind: 'event', event: mk('e1', 'Spring Party') } as never,
      })
    );
    await act(async () => finish());
    expect(useAppStore.getState().clearMapSelection).toHaveBeenCalled();
  });

  it('keeps the first row disabled while a second row deletes', async () => {
    const finishFirst = pendingDelete();
    const finishSecond = pendingDelete();
    render(<AdminEventList />);
    startDelete('Spring Party');
    startDelete('Deskovky');
    await waitFor(() => expect(deletePost).toHaveBeenCalledTimes(2));
    expect(rowOf('Spring Party').getByRole('button', { name: 'Zrušit' })).toBeDisabled();
    expect(rowOf('Deskovky').getByRole('button', { name: 'Zrušit' })).toBeDisabled();

    // The first finishing must not release the second.
    await act(async () => finishFirst());
    expect(rowOf('Deskovky').getByRole('button', { name: 'Zrušit' })).toBeDisabled();
    await act(async () => finishSecond());
  });
});
