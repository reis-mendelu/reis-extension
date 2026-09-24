import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';

/**
 * Escape closes the top sheet, one level per press — the keyboard's version of
 * Android's hardware back (`mobile/backButton.ts`).
 *
 * The phone tree meets a hardware keyboard on an iPad with one attached and on
 * every Mac, where the iPad app is the whole product and Escape is how a dialog
 * closes. The feedback form is answered first because it opens OVER a sheet.
 *
 * On `document`, so it hears the key from wherever focus sits, and it yields to
 * any handler that already took the Escape (the search list drops its
 * highlighted row first) and to an IME composition in progress.
 */
export function useEscapeClosesSheet() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      const s = useAppStore.getState();
      if (s.reportOpen) {
        s.closeReport();
      } else if (s.mobileSheets.length > 0) {
        s.popSheet();
      } else {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
