import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn().mockResolvedValue({}) }));
import { deletePost } from '../../../api/societyPosts';

const ev: MapEvent = {
  id: 'e1',
  title: 'Mine',
  url: '',
  date: '2026-07-10',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
};
const mineEvent = ev;

describe('EventDetailCard society controls', () => {
  beforeEach(() => {
    useAppStore.setState({
      mapMode: 'student',
      adminAssociationId: 'supef',
      loadSocietyPosts: vi.fn() as never,
      language: 'en',
    });
    vi.clearAllMocks();
  });

  it('hides edit/delete for students', () => {
    render(<EventDetailCard event={ev} />);
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('deletes an own event in society mode (arm then confirm)', async () => {
    useAppStore.setState({ mapMode: 'society' });
    render(<EventDetailCard event={ev} />);
    // First click only arms the confirm state — label flips to "Delete for good?".
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // Second click on the (now-relabeled) button actually deletes.
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good?' }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
  });

  it('keeps the card and does not reload when delete fails', async () => {
    const loadSocietyPosts = vi.fn(async () => {});
    const clearMapSelection = vi.fn();
    vi.mocked(deletePost).mockResolvedValueOnce({ error: 'boom' } as never);
    useAppStore.setState({
      mapMode: 'society',
      adminAssociationId: 'supef',
      language: 'cz',
      loadSocietyPosts,
      clearMapSelection,
    });
    render(<EventDetailCard event={mineEvent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' })); // arm confirm (cs: map.delete)
    fireEvent.click(screen.getByRole('button', { name: 'Opravdu smazat?' })); // confirm (cs: map.deleteConfirm)
    await waitFor(() => expect(deletePost).toHaveBeenCalledTimes(1));
    expect(loadSocietyPosts).not.toHaveBeenCalled();
    expect(clearMapSelection).not.toHaveBeenCalled();
  });

  it('shows the human-readable room name, not the raw IS room code', () => {
    // Campus events persist only the IS-internal code ("BA39N1009"); the
    // hall name ("Q01") lives in rooms-index.json. The card must resolve it.
    const campusEvent: MapEvent = { ...ev, roomCode: 'BA39N1009', venueKind: 'campus' };
    render(<EventDetailCard event={campusEvent} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });

  it("hides edit/delete for another society's event in society mode (cross-tenant isolation)", () => {
    useAppStore.setState({ mapMode: 'society', adminAssociationId: 'supef' });
    const otherEvent: MapEvent = { ...ev, societyId: 'esn' };
    render(<EventDetailCard event={otherEvent} />);
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });
});
