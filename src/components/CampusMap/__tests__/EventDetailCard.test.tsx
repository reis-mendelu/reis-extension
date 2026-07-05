import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn().mockResolvedValue({}) }));
import { deletePost } from '../../../api/societyPosts';

const ev: MapEvent = { id: 'e1', title: 'Mine', url: '', date: '2026-07-10', endDate: null, time: null,
  location: null, imageUrl: null, organizerKey: 'pef', societyId: 'supef', coord: [16.6, 49.2],
  roomCode: null, venueKind: 'offcampus', category: 'party' };

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

  it('deletes an own event in society mode', async () => {
    useAppStore.setState({ mapMode: 'society' });
    render(<EventDetailCard event={ev} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
  });
});
