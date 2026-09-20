import { Navigation, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { walkMinutes } from '../../utils/walkTime';

/** Under this, "walk" overstates it — you are standing at the door. */
const ARRIVED_M = 25;

/**
 * What the map says about the route it just drew.
 *
 * Every status the slice can reach says something here. That is the whole job:
 * `routeTo` is a button, and a button that looks fine and does nothing is the
 * failure this card exists to prevent. A student who is denied the permission,
 * or is in Prague, or asked on a Saturday, each get a sentence explaining which
 * of those happened.
 *
 * The garden line is the one piece of copy that is the feature rather than
 * chrome: a first-year does not know the botanical garden is a through-route
 * they may walk for free, and that is exactly why no public map offers it.
 */
export function RouteCard() {
  const { t } = useTranslation();
  const status = useAppStore((s) => s.routeStatus);
  const walk = useAppStore((s) => s.routeWalk);
  const building = useAppStore((s) => s.routeTargetBuilding);
  const clearRoute = useAppStore((s) => s.clearRoute);

  if (status === 'idle') return null;

  const arrived = status === 'ready' && walk !== null && walk.lengthM < ARRIVED_M;
  const throughGarden = walk?.gates.includes('garden') ?? false;

  // Two different silences. `gate-shut` means a walk exists but not right now —
  // the Saturday walk in from FRRMS, where the garden is the only way onto the
  // campus — so the copy hands over the answer that does work, the tram.
  // `no-route` means there is nowhere to walk from here at all, and claiming
  // the garden is shut would be a lie told to someone standing somewhere else
  // entirely.
  const message: string =
    status === 'locating'
      ? t('map.routeLocating')
      : status === 'denied'
        ? t('map.routeDenied')
        : status === 'unavailable'
          ? t('map.routeUnavailable')
          : status === 'too-far'
            ? t('map.routeTooFar')
            : status === 'gate-shut'
              ? t('map.routeGardenShut')
              : status === 'no-route'
                ? t('map.routeNoRoute')
                : arrived
                  ? t('map.routeArrived')
                  : '';

  // Flush, not a card. It lives inside the sheet, which already provides the
  // surface, the rounding and the shadow — a card in there is a box in a box.
  // It floated over the map until the maintainer pointed out that nothing over
  // this basemap is readable without carrying its own dark background.
  return (
    <div className="flex flex-shrink-0 items-start gap-3 px-5 pb-3 pt-1">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Navigation size={16} className="text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {status === 'ready' && walk && !arrived ? (
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-bold leading-tight">
              {t('map.walkMinutes', { n: walkMinutes(walk.lengthM) })}
            </span>
            {building && (
              <span className="text-sm text-base-content/60">
                {t('map.routeTo', { building })}
              </span>
            )}
          </p>
        ) : (
          <p className="text-[13.5px] font-semibold leading-snug">{message}</p>
        )}
        {status === 'ready' && throughGarden && (
          <p className="mt-0.5 text-xs leading-snug text-base-content/60">
            {t('map.routeThroughGarden')}
          </p>
        )}
      </div>
      <button
        type="button"
        // min-h-11, matching the BottomNav's own floor. The old btn-xs circle
        // was a 24px target that erased the whole route.
        className="btn btn-ghost min-h-11 w-11 flex-shrink-0 p-0"
        onClick={clearRoute}
        aria-label={t('common.close')}
      >
        <X size={18} />
      </button>
    </div>
  );
}
