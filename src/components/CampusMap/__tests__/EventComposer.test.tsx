import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';
import type { PostInput } from '../../../api/societyPosts';

const createPost = vi.fn<
  (
    input: PostInput,
    associationId: string,
    createdBy: string
  ) => Promise<{ id?: string; error?: string }>
>(async () => ({ id: 'new' }));
const updatePost = vi.fn<
  (id: string, patch: Record<string, unknown>) => Promise<{ error?: string }>
>(async () => ({}));
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: Parameters<typeof createPost>) => createPost(...a),
  updatePost: (...a: Parameters<typeof updatePost>) => updatePost(...a),
}));

beforeEach(() => {
  createPost.mockClear();
  updatePost.mockClear();
  useAppStore.setState({
    language: 'cz',
    adminAssociationId: 'supef',
    adminSession: { user: { email: 'admin@supef.cz' } } as never,
    draftCoord: null,
    editEventId: null,
    composerOpen: true,
    societyMapEvents: [],
    loadSocietyPosts: vi.fn(async () => {}),
  });
});

describe('EventComposer publish', () => {
  it('creates an offcampus event with the placed coord', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    // language: 'cs' in beforeEach → labels resolve through the real cs.json
    // translations (not raw keys), so queries below match the rendered Czech text.
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    // choose date through MiniCalendar
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.coordLng).toBe(16.61);
  });

  it('preserves venue_kind=campus and room_code when editing a campus event', async () => {
    useAppStore.setState({
      editEventId: 'c1',
      societyMapEvents: [
        {
          id: 'c1',
          title: 'Deskovky',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: null,
          location: 'Q6.06',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'boardgames',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    const patch = updatePost.mock.calls[0][1];
    expect(patch.venue_kind).toBe('campus');
    expect(patch.room_code).toBe('BA39N6006');
    expect(patch.category).toBe('boardgames');
  });
});
