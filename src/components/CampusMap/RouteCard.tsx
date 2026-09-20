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

  // `no-route` is not a shrug. The case that actually produces it is the
  // Saturday walk in from FRRMS, where the garden is the only way onto the
  // campus and there is genuinely no walk — so the copy hands over the answer
  // that does work, which is the tram.
  const message: string =
    status === 'locating'
      ? t('map.routeLocating')
      : status === 'denied'
        ? t('map.routeDenied')
        : status === 'unavailable'
          ? t('map.routeUnavailable')
          : status === 'too-far'
            ? t('map.routeTooFar')
            : status === 'no-route'
              ? t('map.routeGardenShut')
              : arrived
                ? t('map.routeArrived')
                : '';

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body gap-2 p-3">
        <div className="flex items-start gap-2">
          <Navigation size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            {status === 'ready' && walk && !arrived ? (
              <p className="font-semibold">
                {t('map.walkMinutes', { n: walkMinutes(walk.lengthM) })}
                {building ? ` · ${t('map.routeTo', { building })}` : ''}
              </p>
            ) : (
              <p className="font-semibold">{message}</p>
            )}
            {status === 'ready' && throughGarden && (
              <p className="mt-1 text-sm opacity-70">{t('map.routeThroughGarden')}</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            onClick={clearRoute}
            aria-label={t('common.close')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
