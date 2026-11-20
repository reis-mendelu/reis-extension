import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';

/**
 * Keyboard and screen-reader behaviour for a small modal (an iPad with a
 * keyboard, VoiceOver): focus moves to `initial` when it opens, Tab and
 * Shift+Tab cycle between `first` and `last`, Escape calls `onClose`, and
 * focus returns to whatever had it before once it closes.
 *
 * Escape goes through the shared layer stack (hooks/ui/useEscapeLayer): the
 * pop-up can open on resume over a sheet, and one Escape must close only the
 * pop-up, never the sheet under it too.
 */
export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  first: RefObject<HTMLElement | null>,
  last: RefObject<HTMLElement | null>
): void {
  const returnTo = useRef<HTMLElement | null>(null);
  useEscapeLayer(open, onClose);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const a = first.current;
      const b = last.current;
      if (!a || !b) return;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus?.();
    };
  }, [open, first, last]);
}
