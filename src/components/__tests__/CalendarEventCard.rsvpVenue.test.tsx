import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { customEventToLesson } from '../../utils/customEventLesson';
import { rsvpBlockId } from '../../utils/rsvpBlocks';

vi.mock('../../hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('../../hooks/ui/useHintStatus', () => ({ useHintStatus: () => ({ seen: true }) }));
vi.mock('../../hooks/ui/useCourseName', () => ({ useCourseName: (_c?: string, n?: string) => n }));

import { CalendarEventCard } from '../CalendarEventCard';

/**
 * The desktop half of the City Game report. Its block drew the title and the
 * time and nothing else: the room line prints `lesson.room`, and an event
 * placed with a pin and no place name reaches the calendar with an empty one.
 * Label only — the desktop grid has no "show on map" by design.
 */
describe('CalendarEventCard, for an answered society event', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapEvents: [
        {
          id: 'evt-1',
          title: 'City Game',
          url: '',
          date: '2026-09-24',
          endDate: null,
          time: '18:30',
          location: null,
          imageUrl: null,
          organizerKey: 'mendelu',
          societyId: 'esn',
          coord: [16.6077, 49.1976],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'other',
        },
      ],
    } as never);
  });

  it('says where it is', () => {
    const block = customEventToLesson({
      id: rsvpBlockId('evt-1'),
      title: 'City Game',
      date: '20260924',
      startTime: '18:30',
      endTime: '20:00',
    });
    render(<CalendarEventCard lesson={block} language="cz" />);
    expect(screen.getByText('Místo na mapě')).toBeInTheDocument();
  });
});
