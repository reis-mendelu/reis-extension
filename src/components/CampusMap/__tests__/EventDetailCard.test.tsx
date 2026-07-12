import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

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
describe('EventDetailCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      mapMode: 'student',
      adminAssociationId: 'supef',
      language: 'en',
    });
    vi.clearAllMocks();
  });

  // The card is a read-only preview: a society edits/deletes from the "Moje
  // akce" panel, never here (management stays in one place). Guard that no
  // authoring control leaks into the card, even for the society's own event.
  it('never renders edit/delete controls, even for an own event in society mode', () => {
    useAppStore.setState({ mapMode: 'society', adminAssociationId: 'supef' });
    render(<EventDetailCard event={ev} />);
    expect(screen.queryByRole('button', { name: /delete|smazat/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit|upravit/i })).toBeNull();
  });

  it('shows the human-readable room name, not the raw IS room code', () => {
    // Campus events persist only the IS-internal code ("BA39N1009"); the
    // hall name ("Q01") lives in rooms-index.json. The card must resolve it.
    const campusEvent: MapEvent = { ...ev, roomCode: 'BA39N1009', venueKind: 'campus' };
    render(<EventDetailCard event={campusEvent} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });
});
