import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { AdminConsoleHeader } from './AdminConsoleHeader';
import { AdminEventList } from './AdminEventList';
import { AdminConsoleMap } from './AdminConsoleMap';

/**
 * A phone has no room for the desktop's side-by-side list and map, so they share
 * the screen behind a toggle — and the map has to be reachable on its own, not
 * only as a step inside the composer: rows fly the camera to their event, which
 * means nothing if the map can never be seen.
 *
 * Two rules make this work:
 *
 * 1. **The list is never unmounted.** EventComposer (hosted inside
 *    AdminEventList) keeps the entire form — title, date, time, venue, category
 *    — in local useState. Swapping it out for the map destroyed all of it, so
 *    tapping "pick on the map" wiped the form and handed back an empty one. It
 *    is hidden with CSS instead, which preserves every field.
 * 2. **The map is only mounted while visible.** Leaflet measures its container
 *    on init; mounting it inside a `hidden` element gives it a zero-size
 *    viewport and a map that never paints. Mounting on demand costs a re-init
 *    per toggle, which is cheap and, unlike the form, carries nothing worth
 *    keeping.
 *
 * `placingEvent` forces the map and hides the toggle: that flow has its own
 * instruction banner and Cancel, so a second way out would just be ambiguous.
 */
export function MobileAdminConsole() {
  const placing = useAppStore((s) => s.placingEvent);
  const { t } = useTranslation();
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const showMap = placing || tab === 'map';

  const tabBtn = (key: 'list' | 'map', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      className={`tab flex-1 ${tab === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid="admin-console-mobile"
      className="flex h-screen w-full flex-col overflow-hidden bg-base-200 pt-[var(--safe-top,0px)] text-base-content"
    >
      <AdminConsoleHeader compact />
      {!placing && (
        <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0 flex-nowrap">
          {tabBtn('list', t('admin.listTab') as string)}
          {tabBtn('map', t('admin.mapTab') as string)}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {/* Hidden, not unmounted — see rule 1 above. `bg-base-100` matches the
            desktop aside: EventComposer's bg-base-200/60 header is a tint meant
            for base-100 and measures 1.005:1 (invisible) on base-200. */}
        <div className={showMap ? 'hidden' : 'h-full bg-base-100'}>
          <AdminEventList />
        </div>
        {showMap && (
          <div className="h-full">
            <AdminConsoleMap />
          </div>
        )}
      </div>
    </div>
  );
}
