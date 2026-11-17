import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

const base = {
  courseId: '',
  roomStructured: { name: '', id: '' },
  teachers: [],
  periodId: '',
  studyId: '',
  campus: '',
  isDefaultCampus: 'true',
  facultyCode: '',
  isSeminar: 'true',
  isConsultation: 'false',
  room: 'Q02',
};
const at = (id: string, date: string, startTime: string, endTime: string) => ({
  ...base,
  id,
  date,
  startTime,
  endTime,
  courseName: id,
  courseCode: id,
});

/**
 * Týden, 2026-11-06. Two seminars at once on Thursday were squeezed into
 * slivers (Dominik's screenshot), and Petra found the days hard to tell apart.
 */
describe('CalendarScreen — Týden columns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T10:00:00'));
    useAppStore.setState({
      now: new Date('2026-10-26T10:00:00'),
      language: 'cz',
      mobileSelectedDayIso: '2026-10-26',
      mobileSheets: [],
      mobileTab: 'calendar',
      mobileCalendarView: 'week',
      schedule: {
        data: [
          at('Ekonometrie', '20261027', '09:00', '10:50'),
          at('Verejne', '20261029', '09:00', '10:50'),
          at('Financni', '20261029', '10:00', '11:50'),
        ],
        status: 'success',
      },
      customEvents: [],
      hiddenItems: { courses: [], events: [] },
      teachingWeekData: null,
      firstSyncSettled: true,
      syncLoaded: { schedule: true },
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('widens a day with a clash, column and chip alike, and only that day', () => {
    render(<CalendarScreen />);
    const column = (iso: string) =>
      screen.getAllByTestId('week-day-column').find((c) => c.getAttribute('data-day-iso') === iso)!;
    const chip = (iso: string) =>
      screen.getByTestId('day-strip').querySelector<HTMLElement>(`[data-day-iso="${iso}"]`)!;

    expect(column('2026-10-29').style.minWidth).toMatch(/^min\(88px/);
    expect(chip('2026-10-29').style.minWidth).toBe(column('2026-10-29').style.minWidth);
    // A plain day keeps its chip's width, and its chip says the same.
    expect(column('2026-10-27').style.minWidth).toMatch(/^min\(var\(--wk-day\)/);
    expect(chip('2026-10-27').style.minWidth).toBe(column('2026-10-27').style.minWidth);
  });

  it('lays the clash side by side, half the column each', () => {
    render(<CalendarScreen />);
    const a = screen.getByRole('button', { name: /^Verejne,/ });
    const b = screen.getByRole('button', { name: /^Financni,/ });
    expect([a.style.left, a.style.width]).toEqual(['0%', '50%']);
    expect([b.style.left, b.style.width]).toEqual(['50%', '50%']);
  });

  it('tints every other day and divides the days with a hairline', () => {
    render(<CalendarScreen />);
    const columns = screen.getAllByTestId('week-day-column');
    // Monday is today and keeps its own wash; Tuesday and Thursday are tinted.
    expect(columns[0]!.className).toContain('bg-primary/10');
    expect(columns[1]!.className).toContain('bg-base-content/[0.05]');
    expect(columns[2]!.className).not.toContain('bg-base-content/[0.05]');
    expect(columns[3]!.className).toContain('bg-base-content/[0.05]');
    expect(screen.getAllByTestId('week-day-divider')).toHaveLength(columns.length - 1);
  });
});
