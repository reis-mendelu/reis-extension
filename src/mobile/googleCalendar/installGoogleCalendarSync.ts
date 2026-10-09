import { App as CapApp } from '@capacitor/app';
import { GoogleCalendarNative } from './googleCalendarNative';
import { loadSyncState } from './syncStateStore';
import { syncGoogleCalendarNow } from './controller';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';

const DEBOUNCE_MS = 3000;

/**
 * Phone/iPad only, called once from capacitor/startApp.ts. The sync runs only
 * while reIS is open (spec, "Phase 2"): on open, on resume, and whenever the
 * timetable, exams, own events or language change. Returns a teardown (tests).
 */
export function installGoogleCalendarSync(): () => void {
  void (async () => {
    try {
      const { available } = await GoogleCalendarNative.isAvailable();
      const st = await loadSyncState();
      const { connected, email } = await GoogleCalendarNative.status();
      useAppStore.getState().setGcal({
        available,
        connected: connected && st.enabled,
        email,
        lastSyncAt: st.lastSyncAt,
      });
      // On open: the store may already hold the schedule (IndexedDB), so the
      // subscription below would never fire for this launch.
      await syncGoogleCalendarNow('change');
    } catch (e) {
      logError('GoogleCalendar.install', e);
    }
  })();

  // On resume: inside MIN_SYNC_GAP / the schedule TTL nothing refetches. The
  // fingerprint check keeps this cheap when nothing changed.
  const resume = CapApp.addListener('resume', () => void syncGoogleCalendarNow('change'));

  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (
      s.schedule.data === prev.schedule.data &&
      // The open-time sync waits out a loading timetable; a load that fails
      // changes only the status, and must still release it.
      s.schedule.status === prev.schedule.status &&
      s.exams.data === prev.exams.data &&
      s.customEvents === prev.customEvents &&
      s.language === prev.language
    )
      return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncGoogleCalendarNow('change'), DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    void resume.then((h) => h.remove());
  };
}
