import { useEffect, type RefObject } from 'react';

/**
 * What makes the isometric overlay a modal for the keyboard and screen readers: what is behind
 * it is out of reach of Tab and of assistive technology, focus goes to Close and, on close, back
 * to whatever opened it, and Tab wraps inside it.
 */
export function useModalFocus(
  root: RefObject<HTMLElement | null>,
  close: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const el = root.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = el?.parentElement
      ? Array.from(el.parentElement.children).filter((c): c is HTMLElement => c !== el)
      : [];
    const wasInert = siblings.map((c) => c.inert);
    siblings.forEach((c) => (c.inert = true));
    close.current?.focus();
    // Tab stays in the dialog: it wraps at both ends, and focus that has strayed out (a click on the
    // nav, which stays reachable by pointer so a student can leave the map) is pulled back in.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const at = document.activeElement;
      // A dialog opened over the map (the critical-update pop-up after a resume) owns Tab while
      // focus is in it; pulling focus back here would lock a keyboard user out of its buttons.
      const other =
        at instanceof Element ? at.closest('[role="dialog"], [role="alertdialog"]') : null;
      if (other && other !== el) return;
      if (!el.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === last)) {
        e.preventDefault();
        (e.shiftKey && el.contains(at) ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach((c, i) => (c.inert = wasInert[i] ?? false));
      if (opener?.isConnected) opener.focus();
    };
  }, [root, close]);
}
