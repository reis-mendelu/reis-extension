import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Takes the drawn walk back off the map.
 *
 * This × used to be part of the route card, and when the card went — with
 * every sentence it could say — the way out went with it. Measured on the
 * flow afterwards: a walk on screen, three buttons in the sheet, and not one
 * of them able to dismiss it. Tapping the map did not clear it either, so the
 * line stayed until the app was killed.
 *
 * Icon only, and no text anywhere: the reduction this belongs to leaves the
 * line and its time chip, and nothing that reads as a sentence.
 *
 * Shown from the moment a route is ASKED for, not from the moment one is
 * drawn. A fix can take ten seconds on cold GPS, and a student who changed
 * their mind in second two should not have to wait for an answer before they
 * can put it away — `clearRoute` bumps the generation guard, so the request
 * they abandoned cannot come back and draw itself over them.
 */
export function RouteDismiss() {
  const { t } = useTranslation();
  const status = useAppStore((s) => s.routeStatus);
  const clearRoute = useAppStore((s) => s.clearRoute);

  if (status === 'idle') return null;

  return (
    <button
      type="button"
      // min-h-11/min-w-11 for the same reason the route button carries it: the
      // BottomNav in this app already holds itself to 44, and this one is
      // pressed while walking.
      className="btn btn-ghost min-h-11 min-w-11 flex-shrink-0 px-0"
      onClick={clearRoute}
      aria-label={t('common.close')}
    >
      <X size={18} />
    </button>
  );
}
