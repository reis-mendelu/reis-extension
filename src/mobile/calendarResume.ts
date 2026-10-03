import { App as CapApp } from '@capacitor/app';
import { useAppStore } from '../store/useAppStore';

/**
 * Every return to the app opens the calendar where a cold launch would: today,
 * or the first teaching day before term (`selectedDay: null` is "no choice
 * made", resolved by `useCalendarToday`).
 *
 * Google Calendar does exactly this, and it is why a student there never needs
 * a "today" button after reopening — "when I close the app, it also returns to
 * the right day". reIS kept the old selection for as long as the OS kept the
 * process, which on an iPad is days. The day/week view is the student's
 * standing choice and is left alone, as Google leaves it.
 *
 * Capacitor only: the extension's iframe is rebuilt on every IS page load, so
 * it already opens fresh.
 */
export function installCalendarResumeReset(): void {
  void CapApp.addListener('resume', () => {
    useAppStore.getState().setMobileSelectedDay(null);
  });
}
