import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetailSheet } from '../EventDetailSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

const lesson: BlockLesson = {
  id: 'ev1',
  date: '20260401',
  startTime: '10:00',
  endTime: '11:50',
  courseName: 'Algoritmizace',
  courseCode: 'ALG',
  courseId: '159410',
  room: 'Q01 (Poříčí)',
  roomStructured: { name: 'Q01', id: 'Q01' },
  teachers: [{ fullName: 'Jan Novák', shortName: 'Novák', id: 'p1' }],
  periodId: '1',
  studyId: '1',
  campus: 'Poříčí',
  isDefaultCampus: 'true',
  facultyCode: 'PEF',
  isSeminar: 'false',
  isConsultation: 'false',
  isExam: false,
};

describe('EventDetailSheet', () => {
  const setMobileTab = vi.fn();
  const focusRoomByCode = vi.fn();

  beforeEach(() => {
    setMobileTab.mockClear();
    focusRoomByCode.mockClear();
    useAppStore.setState({
      language: 'cz',
      schedule: { data: [lesson], status: 'success', weekStart: null },
      hiddenItems: { courses: [], events: [] },
      mobileTab: 'calendar',
      setMobileTab,
      focusRoomByCode,
    } as never);
  });

  it('shows the lesson title, room, time and teacher', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'ev1' }} onClose={vi.fn()} />);
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
    expect(screen.getByText(/Q01 \(Poříčí\)/)).toBeInTheDocument();
    expect(screen.getByText(/10:00.*11:50/)).toBeInTheDocument();
    expect(screen.getByText(/Jan Novák/)).toBeInTheDocument();
  });

  it('hides the event and closes the sheet', () => {
    const onClose = vi.fn();
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'ev1' }} onClose={onClose} />);

    fireEvent.click(screen.getByText('Skrýt tuto hodinu'));

    expect(useAppStore.getState().hiddenItems.events).toEqual([
      { id: 'ev1', courseCode: 'ALG', courseName: 'Algoritmizace', date: '20260401' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches to the map tab and focuses the room, stripping the campus suffix', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'ev1' }} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Ukázat na mapě'));

    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('Q01');
  });

  it('renders nothing when the eventId is not in the schedule', () => {
    const { container } = render(
      <EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'missing' }} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
