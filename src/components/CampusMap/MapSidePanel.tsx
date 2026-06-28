import type { ReactNode } from 'react';
import { MapPin, PartyPopper } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LandmarkPicker } from './LandmarkPicker';
import { EventsList } from './EventsList';

// Top-right discovery panel with two tabs. "Events" is the primary tab — it
// surfaces the society events pinned on the map; "Places" keeps the original
// grouped destinations. One card so it occupies the same corner all along.
export function MapSidePanel() {
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const { t } = useTranslation();

  const tabBtn = (key: 'places' | 'events', icon: ReactNode, label: string) => (
    <button
      role="tab"
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'places' ? <LandmarkPicker /> : <EventsList />}
      </div>
    </div>
  );
}
