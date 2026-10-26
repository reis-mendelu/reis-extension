import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';

/**
 * Closing the report form, by ✕, backdrop or Escape: close it, then clear it
 * once the exit animation (300ms) is over, so the fields do not visibly empty
 * on the way out.
 *
 * Escape on both trees: the form opens over a sheet or a drawer, and as the
 * topmost Escape layer it is the only one the key closes.
 */
export function useCloseReport(isOpen: boolean, onClose: () => void, reset: () => void) {
  const close = () => {
    onClose();
    setTimeout(reset, 300);
  };
  useEscapeLayer(isOpen, close);
  return close;
}
