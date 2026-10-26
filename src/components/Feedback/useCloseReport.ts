import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';

/**
 * Escape and the report form, on both trees.
 *
 * The form opens over a sheet or a drawer, and as the topmost Escape layer it
 * is the only one the key reaches. It closes it only while nothing is typed:
 * every open mounts a fresh form (FeedbackModalHost keys it on `reportSeq`),
 * so a close throws a typed report away, and an Escape pressed by accident —
 * or pressed to leave a field — must not. With a draft the key is still kept,
 * so the drawer under the form stays too; ✕ closes it deliberately.
 *
 * (A 300ms field reset after closing lived here; the per-open remount made it
 * dead code, so it is gone.)
 */
export function useCloseReport(isOpen: boolean, onClose: () => void, hasDraft: boolean) {
  useEscapeLayer(isOpen, () => {
    if (!hasDraft) onClose();
  });
  return onClose;
}
