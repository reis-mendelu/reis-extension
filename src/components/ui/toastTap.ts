import type { MouseEvent } from 'react';
import { toast } from 'sonner';

/**
 * Tap a toast to clear it. A top-centred toast sits over a sheet's Zpět / ✕,
 * and sonner has no tap-to-dismiss of its own, so the student's tap on what
 * they were trying to reach did nothing for up to 10 s.
 *
 * Only the toast on screen goes. `visibleToasts={1}` queues the rest behind it,
 * and the session-expired prompt can be one of them — dismissing everything
 * would lose it unseen. The toast on screen is always the newest one still
 * active: a new toast takes the front, and one leaving is marked removed.
 *
 * A toast that never expires (the session prompt, `duration: Infinity`) is
 * exempt: it is "useless if missed", so a stray tap on its body must not clear
 * it. It still swipes away, as it always did — that is a deliberate gesture.
 */
export function dismissTappedToast(event: MouseEvent) {
  const target = event.target as Element;
  // Action and cancel buttons dismiss their own toast.
  if (target.closest('button')) return;
  // A drag-select to copy the message (desktop) also ends in a click; sonner's
  // own swipe handler bails on a selection for the same reason.
  if (window.getSelection()?.toString()) return;
  const li = target.closest('[data-sonner-toast]');
  if (li?.getAttribute('data-front') !== 'true' || li.getAttribute('data-removed') === 'true')
    return;
  const front = toast.getToasts().at(-1);
  if (!front || ('duration' in front && front.duration === Infinity)) return;
  toast.dismiss(front.id);
}
