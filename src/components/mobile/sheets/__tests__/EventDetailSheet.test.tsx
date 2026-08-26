import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetailSheet } from '../EventDetailSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

// Captured before any test swaps it for a spy.
const realHideEvent = useAppStore.getState().hideEvent;

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
      schedule: { data: [lesson], status: 'success' },
      hiddenItems: { courses: [], events: [] },
      mobileTab: 'calendar',
      setMobileTab,
      focusRoomByCode,
      // Put the REAL action back. The block below swaps hideEvent for a spy to
      // assert its arguments, and a store action replaced that way stays replaced
      // for the whole file -- so shuffled, this test called the spy and the store
      // was never actually written to.
      hideEvent: realHideEvent,
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

describe('EventDetailSheet across a repeating lesson', () => {
  // The store holds the WHOLE semester, and IS reuses a lesson id across the
  // weeks it repeats — `fetchDualLanguageSchedule` merges its two languages on
  // `id_date_startTime` precisely because the id alone does not identify an
  // occurrence. Looking a lesson up by id therefore returned the first week's
  // copy whatever day the student tapped, and "hide this occurrence" recorded
  // that first date, so the event they wanted gone stayed put.
  const week1: BlockLesson = { ...lesson, date: '20260401', room: 'Q01 (Poříčí)' };
  const week2: BlockLesson = { ...lesson, date: '20260408', room: 'Z18 (Poříčí)' };

  const hideEvent = vi.fn();

  beforeEach(() => {
    hideEvent.mockClear();
    useAppStore.setState({
      language: 'cz',
      schedule: { data: [week1, week2], status: 'success' },
      hiddenItems: { courses: [], events: [] },
      mobileTab: 'calendar',
      hideEvent,
    } as never);
  });

  it('shows the occurrence for the day that was tapped', () => {
    render(
      <EventDetailSheet
        sheet={{ kind: 'eventDetail', eventId: 'ev1', dayIso: '2026-04-08' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Z18/)).toBeInTheDocument();
  });

  it('hides the occurrence the student is looking at, not the first one', () => {
    render(
      <EventDetailSheet
        sheet={{ kind: 'eventDetail', eventId: 'ev1', dayIso: '2026-04-08' }}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Skrýt tuto hodinu'));
    expect(hideEvent).toHaveBeenCalledWith('ev1', 'ALG', 'Algoritmizace', '20260408');
  });

  it('falls back to the id alone when no day came with the sheet', () => {
    // Sheets pushed before this carried no day; they must keep opening rather
    // than rendering nothing.
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'ev1' }} onClose={vi.fn()} />);
    expect(screen.getByText(/Q01/)).toBeInTheDocument();
  });

  /**
   * The fallback must not be an `||`. A day that no longer matches — a refresh
   * dropped the occurrence — would otherwise fall through to the first week's
   * copy, and `onHide` would record ITS date: the exact bug the day was added
   * to fix, re-entering through the escape hatch. Nothing is the right answer.
   */
  it('renders nothing when a supplied day matches no occurrence', () => {
    const { container } = render(
      <EventDetailSheet
        sheet={{ kind: 'eventDetail', eventId: 'ev1', dayIso: '2026-05-20' }}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Q01/)).not.toBeInTheDocument();
  });
});
