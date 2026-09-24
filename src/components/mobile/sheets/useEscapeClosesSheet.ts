import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { hasOpenEscapeLayer } from '../../../hooks/ui/useEscapeLayer';

/**
 * Escape closes the top sheet, one level per press — the keyboard's version of
 * Android's hardware back (`mobile/backButton.ts`).
 *
 * The phone tree meets a hardware keyboard on an iPad with one attached and on
 * every Mac, where the iPad app is the whole product and Escape is how a dialog
 * closes. Anything open OVER the stack is answered first and closes itself: the
 * feedback form and the side drawers register as Escape layers
 * (`hooks/ui/useEscapeLayer`), and this yields while one is open.
 * While an IS link is opening (ExternalLinkOverlay's scrim, above everything)
 * nothing is popped: the link was pressed inside the sheet, and the in-app
 * browser is about to present over it.
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
      if (s.externalOpening || hasOpenEscapeLayer() || s.mobileSheets.length === 0) return;
      e.preventDefault();
      s.popSheet();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
