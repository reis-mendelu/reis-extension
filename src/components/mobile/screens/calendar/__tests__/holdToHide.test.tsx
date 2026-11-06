import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WeekBlock } from '../WeekBlock';
import { AgendaEvent } from '../AgendaEvent';
import { useAppStore } from '../../../../../store/useAppStore';
import type { BlockLesson } from '../../../../../types/calendarTypes';

const seminar = {
  id: 'L1',
  date: '20261029',
  startTime: '09:00',
  endTime: '10:50',
  courseCode: 'EBC-VF1',
  courseName: 'Veřejné finance 1',
  isSeminar: 'true',
  room: 'Q02',
  roomStructured: { name: 'Q02', id: '' },
  teachers: [],
} as unknown as BlockLesson;

const block = (lesson: BlockLesson) => ({ lesson, top: 0, height: 20, lane: 0, lanes: 1 });

const hold = (el: HTMLElement) => {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 5,
    clientY: 5,
  });
  act(() => void vi.advanceTimersByTime(700));
  fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'touch' });
  fireEvent.click(el);
};

/**
 * Suggestion #43: on the phone a lesson could be renamed but never hidden. A
 * hold on it in Týden or Den opens the hide menu; a tap still opens the
 * subject, and the lift that ends a hold is not a tap (2026-11-06).
 */
describe('hold a lesson to hide it', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ language: 'cz', mobileSheets: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('Týden: a hold opens the hide menu and not the subject', () => {
    const onOpen = vi.fn();
    render(<WeekBlock block={block(seminar)} wide={false} gridPx={600} onOpen={onOpen} />);
    hold(screen.getByRole('button'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'hideLesson', lesson: seminar }]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('Týden: a tap still opens the subject', () => {
    const onOpen = vi.fn();
    render(<WeekBlock block={block(seminar)} wide={false} gridPx={600} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(seminar);
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });

  it('Týden: an exam or an own event has nothing to hide, as on the extension', () => {
    const exam = { ...seminar, isExam: true } as BlockLesson;
    const own = { ...seminar, isCustom: true } as BlockLesson;
    const { unmount } = render(
      <WeekBlock block={block(exam)} wide={false} gridPx={600} onOpen={vi.fn()} />
    );
    hold(screen.getByRole('button'));
    unmount();
    render(<WeekBlock block={block(own)} wide={false} gridPx={600} onOpen={vi.fn()} />);
    hold(screen.getByRole('button'));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });

  it('Den: a hold on the row opens the hide menu and not the subject', () => {
    const onOpenSubject = vi.fn();
    render(<AgendaEvent lesson={seminar} onOpenSubject={onOpenSubject} onShowOnMap={vi.fn()} />);
    hold(screen.getByText('Veřejné finance 1'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'hideLesson', lesson: seminar }]);
    expect(onOpenSubject).not.toHaveBeenCalled();
  });
});
