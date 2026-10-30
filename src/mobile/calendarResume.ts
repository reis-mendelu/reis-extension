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
 * process, which on an iPad is days. The SAVED day/week view comes back too:
 * a view tried in the chooser is not a choice, and Google likewise reopens in
 * the view the student keeps.
 *
 * Capacitor only: the extension's iframe is rebuilt on every IS page load, so
 * it already opens fresh.
 */
export function installCalendarResumeReset(): void {
  void CapApp.addListener('resume', () => {
    // The clock first. The pulse is a setInterval the OS suspended, so until
    // its next tick `now` is still the moment the app went away — last night,
    // after a night — and the today circle would sit on yesterday.
    useAppStore.getState().updatePulse();
    useAppStore.getState().setMobileSelectedDay(null);
    useAppStore.getState().restoreCalendarView();
  });
}
