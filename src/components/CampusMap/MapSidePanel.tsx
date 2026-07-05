import type { ReactNode } from 'react';
import { MapPin, PartyPopper } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LandmarkPicker } from './LandmarkPicker';
import { EventsList } from './EventsList';
import { MyEventsPanel } from './MyEventsPanel';

// Top-right discovery panel with two tabs. "Events" is the primary tab — it
// surfaces the society events pinned on the map; "Places" keeps the original
// grouped destinations. One card so it occupies the same corner all along.
// In Society mode the panel swaps entirely for MyEventsPanel (the
// association's own authoring view), bypassing the student tabs.
export function MapSidePanel() {
  const mode = useAppStore((s) => s.mapMode);
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const { t } = useTranslation();

  if (mode === 'society') {
    return (
      <div className="flex max-h-[80vh] w-64 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
        <MyEventsPanel />
      </div>
    );
  }

  const tabBtn = (key: 'places' | 'events', icon: ReactNode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`map-tab-${key}`}
      aria-selected={tab === key}
      aria-controls="map-tabpanel"
      className={`tab gap-1.5 ${tab === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => setTab(key)}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="flex max-h-[80vh] w-64 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0">
        {tabBtn('events', <PartyPopper size={13} />, t('map.events'))}
        {tabBtn('places', <MapPin size={13} />, t('map.places'))}
      </div>
      <div
        id="map-tabpanel"
        role="tabpanel"
        aria-labelledby={`map-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {tab === 'places' ? <LandmarkPicker /> : <EventsList />}
      </div>
    </div>
  );
}
