import { useEffect } from 'react';
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
 * armed once per opening. An opening further off than a timer can count is left
 * alone: the screen re-arms when the list changes, and that is long before.
 */
export function useRefreshAtExamOpening(active: boolean): void {
  const demo = useAppStore((s) => s.demoMode);
  const opening = useAppStore((s) => nextRegistrationOpening(s.exams.data, s.now.getTime()));
  useEffect(() => {
    if (!active || demo || opening === null) return;
    const timers = OPENING_REFRESH_OFFSETS_MS.flatMap((offset) => {
      const delay = opening + offset - Date.now();
      if (delay < 0 || delay > MAX_TIMER_DELAY_MS) return [];
      return [
        setTimeout(() => {
          if (Date.now() >= opening) useAppStore.getState().triggerExamsRefresh();
        }, delay),
      ];
    });
    return () => timers.forEach(clearTimeout);
  }, [active, demo, opening]);
}
