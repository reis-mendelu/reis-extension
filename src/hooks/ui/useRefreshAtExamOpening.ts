import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  MAX_TIMER_DELAY_MS,
  nextRegistrationOpening,
  OPENING_REFRESH_OFFSETS_MS,
} from '../../utils/exams/registrationOpening';

/**
 * While the exam list is in front, asks IS again right after the next
 * registration opens, so the Přihlásit button appears within a second or two
 * instead of at the next sync.
 *
 * Only the refresh is scheduled. Whether a term can be registered stays IS's
 * answer (`canRegisterNow`); this never unlocks anything from the clock. A few
 * retries cover IS answering a moment late, and stop with the last one.
 *
 * Keyed on the opening's timestamp, not on the ticking `now`, so the timers are
 * armed once per opening. An opening further off than a timer can count is not
 * armed yet: a wake-up a day later re-runs the effect, so a view left open
 * overnight still arms it once the opening is in range.
 */
export function useRefreshAtExamOpening(active: boolean): void {
  const demo = useAppStore((s) => s.demoMode);
  const opening = useAppStore((s) => nextRegistrationOpening(s.exams.data, s.now.getTime()));
  const [wake, setWake] = useState(0);
  useEffect(() => {
    if (!active || demo || opening === null) return;
    const untilOpening = opening - Date.now();
    if (untilOpening > MAX_TIMER_DELAY_MS) {
      const id = setTimeout(() => setWake((n) => n + 1), MAX_TIMER_DELAY_MS);
      return () => clearTimeout(id);
    }
    const timers = OPENING_REFRESH_OFFSETS_MS.flatMap((offset) => {
      const delay = opening + offset - Date.now();
      if (delay < 0) return [];
      return [
        setTimeout(() => {
          if (Date.now() >= opening) useAppStore.getState().triggerExamsRefresh();
        }, delay),
      ];
    });
    return () => timers.forEach(clearTimeout);
    // `wake` only re-runs the effect; it is not read.
  }, [active, demo, opening, wake]);
}
