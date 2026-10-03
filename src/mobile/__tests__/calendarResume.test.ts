import { describe, it, expect, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

const addListener = vi.fn();
vi.mock('@capacitor/app', () => ({ App: { addListener } }));

describe('installCalendarResumeReset', () => {
  it('puts the calendar back where a cold launch opens it on every resume', async () => {
    const { installCalendarResumeReset } = await import('../calendarResume');
    installCalendarResumeReset();

    const [event, handler] = addListener.mock.calls[0] as [string, () => void];
    expect(event).toBe('resume');

    useAppStore.setState({ mobileSelectedDayIso: '2026-11-12', mobileCalendarView: 'week' });
    handler();
    // null is "no choice made": today, or the first teaching day before term.
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
    // The view is the student's standing choice, like Google's — kept.
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });
});
