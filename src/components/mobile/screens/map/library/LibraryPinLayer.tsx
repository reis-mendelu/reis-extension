import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Library } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useEventPinPlacement } from '../../../../CampusMap/useEventPinPlacement';
import { PIN_FACE, PIN_FACE_CHOSEN, PIN_TAP_PAD } from '../../../../CampusMap/pinGeometry';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { isDemoMode } from '../../../../../errors/demoMode';
import { LIBRARY_COORD, openLibrary } from './openLibrary';

/** Fixed ink on the light basemap, like every place pin; not a society's colour or the buildings' blue. */
const PIN_INK = '#6D28D9';

/**
 * The library on the campus overview: the standard place pin (pinGeometry.ts,
 * the Sportera and venue pins' size), on the study rooms at the left of
 * building A, named only once chosen (Dominik, 2026-11-16: "everything on the
 * map is just a pin, and the study rooms should be exactly that"). Not drawn
 * once a building is open: there the rooms themselves are the way in.
 *
 * Reading the free hours is a store action; this only asks for it when the map
 * is shown. Nothing about the student is sent to read them.
 */
export function LibraryPinLayer() {
  const { t } = useTranslation();
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const chosen = useAppStore((s) => s.mapSelection?.kind === 'library');
  const load = useLibraryStore((s) => s.load);
  const bookable = canBookLibrary() && !isDemoMode();
  useEffect(() => {
    if (bookable) void load();
  }, [bookable, load]);

  const items = useMemo(
    () => (bookable && activeBuildingId === null ? [{ key: 'library', coord: LIBRARY_COORD }] : []),
    [bookable, activeBuildingId]
  );
  const { placed, pane } = useEventPinPlacement(items, null);
  const at = placed.find((p) => p.key === 'library');
  if (!pane || !at || items.length === 0) return null;

  const face = chosen ? PIN_FACE_CHOSEN : PIN_FACE;
  return createPortal(
    <button
      type="button"
      data-testid="library-pin"
      className="group pointer-events-auto absolute left-0 top-0 leaflet-zoom-animated"
      style={{
        transform: `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`,
        padding: PIN_TAP_PAD,
        zIndex: chosen ? 1 : 0,
      }}
      aria-label={t('mobile.library.pinLabel')}
      aria-pressed={chosen}
      onClick={() => openLibrary()}
    >
      <span
        className="flex items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110"
        style={{
          width: face,
          height: face,
          color: PIN_INK,
          boxShadow: `0 0 0 ${chosen ? 3 : 2}px ${PIN_INK}, 0 1px ${chosen ? 7 : 4}px rgba(0,0,0,${chosen ? 0.4 : 0.28})`,
        }}
      >
        <Library size={chosen ? 18 : 15} aria-hidden="true" />
      </span>
      {chosen && (
        <span
          className="pointer-events-none absolute left-1/2 top-full -mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-1.5 py-px text-[11px] font-bold shadow"
          style={{ color: '#111827' }}
        >
          {t('mobile.library.pinLabel')}
        </span>
      )}
    </button>,
    pane
  );
}
