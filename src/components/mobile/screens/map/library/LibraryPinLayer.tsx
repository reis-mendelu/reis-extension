import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Library } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useEventPinPlacement } from '../../../../CampusMap/useEventPinPlacement';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { roomsOpenCount } from '../../../../../mobile/library/libraryModel';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { isDemoMode } from '../../../../../errors/demoMode';
import { openLibrary } from './openLibrary';

/** The library, where building A stands on the campus overview. */
const LIBRARY_COORD: [number, number] = [16.6152, 49.20996];

const todayIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The library's one pin on the campus overview: a small white disc like an
 * event's, with a green count of the rooms that still have an hour today. It
 * follows `SocietyPinLayer` — its own layer over the events' pane and
 * placement, never grouped with or listed among the events — and is not drawn
 * once a building is open, where the rooms themselves are the way in.
 *
 * Reading the free hours is a store action; this only asks for it when the map
 * is shown. Nothing about the student is sent to read them.
 */
export function LibraryPinLayer() {
  const { t } = useTranslation();
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const blocks = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
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

  const count = roomsOpenCount(blocks, todayIso(new Date()), new Date());
  const label = t('mobile.library.pinAria', { count });
  return createPortal(
    <button
      type="button"
      data-testid="library-pin"
      className="group pointer-events-auto absolute left-0 top-0 leaflet-zoom-animated"
      style={{ transform: `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)` }}
      title={t('mobile.library.title')}
      aria-label={label}
      onClick={openLibrary}
    >
      <span
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-neutral"
        style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,.28)' }}
      >
        <Library size={16} aria-hidden="true" />
        {status === 'ready' && count > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-success px-1 text-[9px] font-bold leading-none text-success-content"
          >
            {count}
          </span>
        )}
      </span>
    </button>,
    pane
  );
}
