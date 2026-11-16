import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Library } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useEventPinPlacement } from '../../../../CampusMap/useEventPinPlacement';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { roomsOpenCount } from '../../../../../mobile/library/libraryModel';
import { shownDay } from '../../../../../mobile/library/libraryDay';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { isDemoMode } from '../../../../../errors/demoMode';
import { openLibrary } from './openLibrary';
import { chipOffset } from './chipPlacement';

/** The library, where building A stands on the campus overview. */
const LIBRARY_COORD: [number, number] = [16.6152, 49.20996];
/** The chip's hit box: 44 px tall for a finger, wide enough for its name and count. */
const CHIP_W = 124;
const CHIP_H = 44;

/**
 * The library on the campus overview: a white chip that says "Studovny" and,
 * once the library has answered, how many rooms still have an hour on the shown
 * day. It replaced a 30 px dot that sat under the same fingertip as Vazbič's
 * pin; the chip steps aside from any society pin or venue (chipPlacement.ts).
 * Not drawn once a building is open: there the rooms themselves are the way in.
 *
 * Reading the free hours is a store action; this only asks for it when the map
 * is shown. Nothing about the student is sent to read them.
 */
export function LibraryPinLayer() {
  const { t } = useTranslation();
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const societyPins = useAppStore((s) => s.societyPins);
  const venuePins = useAppStore((s) => s.venuePins);
  const blocks = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
  const load = useLibraryStore((s) => s.load);
  const bookable = canBookLibrary() && !isDemoMode();
  useEffect(() => {
    if (bookable) void load();
  }, [bookable, load]);

  const items = useMemo(
    () =>
      bookable && activeBuildingId === null
        ? [
            { key: 'library', coord: LIBRARY_COORD },
            ...[...venuePins, ...societyPins].map((p) => ({ key: `o:${p.id}`, coord: p.coord })),
          ]
        : [],
    [bookable, activeBuildingId, venuePins, societyPins]
  );
  const { placed, pane } = useEventPinPlacement(items, null);
  const at = placed.find((p) => p.key === 'library');
  if (!pane || !at || items.length === 0) return null;

  const others = placed.filter((p) => p.key !== 'library');
  const off = chipOffset(at, others, CHIP_W, CHIP_H);
  const now = new Date();
  const count = roomsOpenCount(blocks, shownDay(now).day, now);
  const ready = status === 'ready';
  return createPortal(
    <button
      type="button"
      data-testid="library-pin"
      className="pointer-events-auto absolute left-0 top-0 flex items-center justify-center leaflet-zoom-animated"
      style={{
        width: CHIP_W,
        height: CHIP_H,
        transform: `translate(${at.x + off.x}px, ${at.y + off.y}px) translate(-50%, -50%)`,
      }}
      aria-label={ready ? t('mobile.library.pinAria', { count }) : t('mobile.library.pinLabel')}
      onClick={() => openLibrary()}
    >
      <span
        className="flex h-8 items-center gap-1.5 rounded-full bg-white pl-2 pr-2.5 text-[13px] font-semibold text-neutral"
        style={{ border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,.28)' }}
      >
        <Library size={15} aria-hidden="true" />
        {t('mobile.library.pinLabel')}
        {ready && count > 0 && (
          <span
            aria-hidden="true"
            className="flex h-4 min-w-4 items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold leading-none text-success-content"
          >
            {count}
          </span>
        )}
      </span>
    </button>,
    pane
  );
}
