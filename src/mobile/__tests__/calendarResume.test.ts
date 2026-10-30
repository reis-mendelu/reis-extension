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

    // The pulse is a setInterval, suspended in the background: until its next
    // tick the store's clock is still last night, and the today circle with it.
    const lastNight = new Date(2026, 9, 1, 23, 0);
    useAppStore.setState({
      mobileSelectedDayIso: '2026-11-12',
      // A day peeked at from the week, left open overnight.
      mobileCalendarView: 'day',
      savedCalendarView: 'week',
      now: lastNight,
    });
    handler();
    expect(useAppStore.getState().now.getTime()).toBeGreaterThan(lastNight.getTime());
    // null is "no choice made": today, or the first teaching day before term.
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
    // The saved view comes back — a peek at one day was not a choice.
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });
});
