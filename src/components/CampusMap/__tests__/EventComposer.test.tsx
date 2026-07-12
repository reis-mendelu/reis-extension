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
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

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
    reloadMapEvents: vi.fn(async () => {}),
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
    // Publishing a live event must refresh the public feed so it shows on the
    // student "Akce" tab without a full reload (stale load-once cache fix).
    expect(useAppStore.getState().reloadMapEvents).toHaveBeenCalled();
    // And the society gets a clear confirmation it worked.
    expect(toast.success).toHaveBeenCalled();
  });

  it('keeps publish disabled until every field is filled, then enables it', async () => {
    render(<EventComposer onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit akci' });
    expect(publish).toBeDisabled();

    // Completing every field enables publish.
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    await waitFor(() => expect(publish).not.toBeDisabled());
  });

  it('publishes with the chosen start time', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // Time: open the reIS-native picker, choose hour 19 then minute 30.
    fireEvent.click(screen.getByRole('button', { name: 'Čas' }));
    fireEvent.click(screen.getByRole('button', { name: '19' }));
    fireEvent.click(screen.getByRole('button', { name: '30' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].time).toBe('19:30');
  });

  it('publishes with the category chosen in the picker (not hardcoded party)', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), {
      target: { value: 'Kvíz večer' },
    });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // Pick the "Kvíz" (quiz) category instead of leaving the default party.
    fireEvent.click(screen.getByRole('button', { name: 'Kvíz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].category).toBe('quiz');
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

  it('shows the hall name (not the IS code) in the picked-room chip when editing', () => {
    // Campus events save only room_code and a null location, so the chip must
    // resolve BA39N1009 → "Q01" rather than echoing the raw code.
    useAppStore.setState({
      editEventId: 'c2',
      societyMapEvents: [
        {
          id: 'c2',
          title: 'Zootopia',
          url: '',
          date: '2026-07-14',
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N1009',
          venueKind: 'campus',
          category: 'party',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });
});
