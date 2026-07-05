import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';

vi.mock('../../../api/societyPosts', async (orig) => ({
  ...(await orig<typeof import('../../../api/societyPosts')>()),
  createPost: vi.fn().mockResolvedValue({ id: 'new1' }),
}));
import { createPost } from '../../../api/societyPosts';

describe('EventComposer (create)', () => {
  beforeEach(() => {
    useAppStore.setState({ adminAssociationId: 'supef', adminSession: { user: { email: 'a@supef.cz' } } as never, draftCoord: null, language: 'en' });
    vi.clearAllMocks();
  });

  it('publish is disabled until name, date and place are set', async () => {
    render(<EventComposer onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: /publish/i });
    expect(publish).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring Party' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-07-10' } });
    act(() => { useAppStore.setState({ draftCoord: [16.61, 49.21] }); }); // as if the map was clicked
    expect(screen.getByRole('button', { name: /publish/i })).toBeEnabled();
  });

  it('publishes via createPost with the picked coordinate', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    const onDone = vi.fn();
    render(<EventComposer onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring Party' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-07-10' } });
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => expect(createPost).toHaveBeenCalled());
    const [input, assoc] = vi.mocked(createPost).mock.calls[0];
    expect(assoc).toBe('supef');
    expect(input).toMatchObject({ title: 'Spring Party', date: '2026-07-10', venueKind: 'offcampus', coordLng: 16.61, coordLat: 49.21 });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
