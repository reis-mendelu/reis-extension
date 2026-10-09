import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Tapping the tab you are already on takes you home — the iOS convention, and
 * on the calendar "home" is today. The second way back to today besides the
 * date in the header, and one that costs no button at all.
 */
describe('BottomNav — tapping the calendar tab again', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      mobileTab: 'calendar',
      language: 'cz',
      keyboardOpen: false,
      mobileSelectedDayIso: '2026-05-04',
      schedule: { data: [], status: 'success' },
      hiddenItems: { courses: [], events: [] },
      teachingWeekData: null,
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('goes back to today', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendář' }));
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
  });

  // After a peek at one day from the week, the tab that takes you home takes
  // you back to the view you saved, too.
  it('returns to the saved view', () => {
    useAppStore.setState({ mobileCalendarView: 'day', savedCalendarView: 'week' } as never);
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendář' }));
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });

  it('arriving from another tab keeps the day the student left', () => {
    useAppStore.setState({ mobileTab: 'exams' } as never);
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendář' }));
    expect(useAppStore.getState().mobileTab).toBe('calendar');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-05-04');
  });
});
