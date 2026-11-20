import { useEffect, useRef, type RefObject } from 'react';

/**
 * Keyboard and screen-reader behaviour for a small modal (an iPad with a
 * keyboard, VoiceOver): focus moves to `initial` when it opens, Tab and
 * Shift+Tab cycle between `first` and `last`, Escape calls `onClose`, and
 * focus returns to whatever had it before once it closes.
 */
export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  first: RefObject<HTMLElement | null>,
  last: RefObject<HTMLElement | null>
): void {
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
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
  }, [open, onClose, first, last]);
}
