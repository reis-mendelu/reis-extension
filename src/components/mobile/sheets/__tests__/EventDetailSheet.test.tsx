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

/**
 * "Skrýt tuto hodinu" is gone from this sheet — the slot holds "Ukázat
 * předmět" now, per the sprint list — so the two tests that clicked it went
 * with it. What they were really protecting, that the sheet resolves the
 * occurrence the student is looking at rather than the first copy of a weekly
 * lesson, is still pinned below by the test that a non-matching day renders
 * NOTHING rather than falling through to week one.
 *
 * `hideEvent` itself is untouched in the store, and the restore list on the
 * profile tab still reads it; nothing in the phone UI calls it any more.
 */
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
    } as never);
  });

  it('shows the lesson title, room, time and teacher', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'ev1' }} onClose={vi.fn()} />);
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
    expect(screen.getByText(/Q01 \(Poříčí\)/)).toBeInTheDocument();
    expect(screen.getByText(/10:00.*11:50/)).toBeInTheDocument();
    expect(screen.getByText(/Jan Novák/)).toBeInTheDocument();
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
