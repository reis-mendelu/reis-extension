import { Navigation } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * "Kam jdeš?" — opens the destination picker.
 *
 * Lives in the sheet's peek row, not floating over the map, and the reason is
 * contrast rather than tidiness. As an overlay it was `btn btn-primary btn-sm`:
 * a 32px pale-green pill on a basemap that is always light whatever the app
 * theme is, and it read as a ghost. Everything that floats over this map either
 * carries its own dark surface — as the search bar does, with a hardcoded
 * rgba — or disappears. On the sheet it sits on bg-base-100 and simply works,
 * in both themes.
 *
 * `min-h-11` because the BottomNav in this same app already holds itself to 44,
 * and this one is pressed while walking.
 */
export function RouteButton() {
  const { t } = useTranslation();
  // In the store rather than useState: "NO generic state" is an Iron Rule here,
  // and it means something else can open the picker later — a search result, a
  // tapped building.
  const open = useAppStore((s) => s.routePickerOpen);
  const setOpen = useAppStore((s) => s.setRoutePickerOpen);
  const status = useAppStore((s) => s.routeStatus);

  return (
    <button
      type="button"
      className="btn btn-primary min-h-11 flex-shrink-0 gap-2"
      onClick={() => setOpen(!open)}
      disabled={status === 'locating'}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      <Navigation size={16} aria-hidden />
      {t('map.routeTakeMeThere')}
    </button>
  );
}
