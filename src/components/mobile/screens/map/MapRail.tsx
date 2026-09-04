import { ChevronLeft, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useRailResize } from './useRailResize';
import { MapPanelBody } from './MapPanelBody';
import buildingsJson from '../../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../../types/campusMap';
import type { MapSheetTab } from '../../../../store/types';

const META = buildingsJson as BuildingsMeta;

/**
 * The map panel on a tablet: a sidebar, not a sheet.
 *
 * This exists because the sheet could not be dressed into one. A sheet's whole
 * vocabulary is vertical — a grab pill, three detents, a chevron pointing DOWN
 * — and every one of those is a lie on a panel that lives at the right-hand
 * edge. It was collapsing "down" into somewhere there is no down.
 *
 * A rail has two states, open and closed, and that is the entire model. Closed,
 * it leaves a single button at the edge to bring it back; there is no half-open
 * rail because a half-open rail is a sheet again.
 *
 * It OVERLAYS the map rather than taking a column out of it, which is also what
 * iPadOS does with a sidebar in portrait — and 834pt portrait is where this app
 * lives. The alternative, a real split (DaisyUI's `drawer-open` is exactly
 * that), resizes the Leaflet canvas on every toggle and would need
 * `invalidateSize()` on each one; MapScreen's own note explains that the panel
 * never resizing the canvas is what keeps that unnecessary. Overlaying keeps
 * the promise.
 *
 * Deliberately NOT daisyUI's `drawer`: `.drawer-side` is
 * `position: fixed; top: 0; height: 100dvh` against the viewport, so it would
 * cover this screen's floating search bar and the BottomNav, and `.drawer`
 * wants to be a grid wrapper around content that here is an absolutely
 * positioned canvas.
 */
export function MapRail() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.mapRailOpen);
  const setOpen = useAppStore((s) => s.setMapRailOpen);
  const width = useAppStore((s) => s.mapRailWidth);
  const tab = useAppStore((s) => s.mapTab);
  const setTab = useAppStore((s) => s.setMapTab);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { resizing, railHandlers } = useRailResize();

  const selectedEvent = selection?.kind === 'event' ? selection.event : null;
  const showBudova = activeBuildingId !== null;
  const activeTab: MapSheetTab =
    (tab === 'budova' && !showBudova) || tab === 'knihovna' ? 'akce' : tab;

  // Picking a pin while the rail is closed has to bring it back — otherwise the
  // pin highlights and the answer to the tap is somewhere the student cannot
  // see. This is the only thing that opens the rail on the student's behalf.
  useEffect(() => {
    if (selectedEvent) setOpen(true);
  }, [selectedEvent, setOpen]);

  const buildingName =
    activeBuildingId !== null
      ? (META.buildings.find((b) => b.id === activeBuildingId)?.name ?? '')
      : '';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('mobile.map.railOpen')}
        aria-expanded={false}
        // The one thing left behind when the rail is away: a pill at the edge
        // it went into, so the way back is where it left from.
        className="absolute right-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000] flex h-11 w-11 items-center justify-center rounded-2xl border border-base-content/10 bg-base-100 shadow-drawer"
      >
        <PanelRightOpen size={18} className="text-base-content/70" />
      </button>
    );
  }

  return (
    <aside
      data-testid="map-rail"
      aria-label={t('mobile.map.tabEvents')}
      style={{ width }}
      // Floating, inset, fully rounded — this screen's own idiom. The search
      // bar above is already a rounded pill over the canvas with a margin, and
      // a panel welded to the screen edge beside it reads as another app's
      // furniture. The hairline is load-bearing, not trim: base-100 on
      // base-200 is 1.03:1 in the light theme, so without it the panel has no
      // edge there at all.
      // NOT full height. A rail pinned top-to-bottom was covering the bottom
      // of the map and the floating BottomNav with it, to hold a list whose
      // job is "what is on this week" — and anyone who wants the rest scrolls.
      // So it hugs its content and stops at 55vh, which is about the height it
      // was, over 1.7. Below that cap the list scrolls inside the rail.
      className={`absolute right-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000] flex max-h-[55vh] flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-drawer ${
        resizing ? '' : 'transition-[width] duration-200 ease-out'
      }`}
    >
      {/* The left edge is the resize handle — the axis a tablet can afford to
          trade. Not a detent: it sets a width and keeps it. */}
      <div
        {...railHandlers}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('mobile.map.railResize')}
        className="group absolute inset-y-0 left-0 z-10 flex w-3 cursor-col-resize touch-none items-center justify-center"
      >
        <span
          className={`block h-10 w-[3px] rounded-full transition-colors ${
            resizing ? 'bg-primary' : 'bg-base-300 group-hover:bg-base-content/30'
          }`}
        />
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 py-4 pl-6 pr-3">
        {selectedEvent ? (
          <button
            type="button"
            onClick={clearMapSelection}
            className="-ml-1.5 flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1.5 py-1 text-left hover:bg-base-200"
          >
            <ChevronLeft size={18} className="flex-shrink-0 text-base-content/40" />
            <span className="truncate font-display text-lg font-bold tracking-tight">
              {t('mobile.map.tabEvents')}
            </span>
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight">
            {showBudova ? buildingName : t('mobile.map.tabEvents')}
          </span>
        )}
        {/* Closes the rail. Points RIGHT, at the edge it collapses into — the
            chevron-down it replaces was describing a gesture this panel does
            not have. */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('mobile.map.railClose')}
          aria-expanded
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg hover:bg-base-200"
        >
          <PanelRightClose size={18} className="text-base-content/50" />
        </button>
      </div>

      {showBudova && !selectedEvent && (
        <div role="tablist" className="mx-5 mb-2 flex flex-shrink-0 gap-1 rounded-lg bg-base-content/5 p-1">
          {(['akce', 'budova'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setTab(key)}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold ${
                activeTab === key
                  ? 'bg-base-100 text-base-content shadow-sm'
                  : 'text-base-content/60'
              }`}
            >
              {key === 'akce' ? t('mobile.map.tabEvents') : t('mobile.map.tabBuilding', { name: buildingName })}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-4 pl-1">
        <MapPanelBody selectedEvent={selectedEvent} activeTab={activeTab} flush />
      </div>
    </aside>
  );
}
