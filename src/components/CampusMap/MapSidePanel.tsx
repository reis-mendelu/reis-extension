import type { ReactNode } from 'react';
import { MapPin, PartyPopper, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { LandmarkPicker } from './LandmarkPicker';
import { EventsList } from './EventsList';
import { MyEventsPanel } from './MyEventsPanel';

type TabKey = 'events' | 'places' | 'mine';

// Top-right discovery panel. "Events" surfaces the society events pinned on
// the map; "Places" keeps the original grouped destinations. A logged-in
// association additionally gets a third "Moje akce" tab — selecting it is
// what *enters* Society mode (there's no separate mode toggle anymore); going
// back to Events/Places from there exits it. One card, one tablist, no early
// return, so the panel always occupies the same corner.
export function MapSidePanel() {
  const mode = useAppStore((s) => s.mapMode);
  const setMode = useAppStore((s) => s.setMapMode);
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const role = useAppStore((s) => s.adminRole);
  const assocId = useAppStore((s) => s.adminAssociationId);
  const { t } = useTranslation();

  const isSociety = mode === 'society';
  const active: TabKey = isSociety ? 'mine' : tab;
  const soc = assocId ? societyById(assocId) : null;

  const select = (key: TabKey) => {
    if (key === 'mine') {
      setMode('society');
      return;
    }
    if (isSociety) setMode('student');
    setTab(key);
  };

  const tabBtn = (key: TabKey, icon: ReactNode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`map-tab-${key}`}
      aria-selected={active === key}
      aria-controls="map-tabpanel"
      className={`tab gap-1.5 ${active === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => select(key)}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex max-h-[80vh] w-64 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0">
        {tabBtn('events', <PartyPopper size={13} />, t('map.events'))}
        {tabBtn('places', <MapPin size={13} />, t('map.places'))}
        {role === 'association' &&
          tabBtn('mine', <Sparkles size={13} style={{ color: soc?.color }} />, t('map.myEvents'))}
      </div>
      <div
        id="map-tabpanel"
        role="tabpanel"
        aria-labelledby={`map-tab-${active}`}
        className={`min-h-0 flex-1 ${isSociety ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
      >
        {isSociety ? <MyEventsPanel /> : active === 'places' ? <LandmarkPicker /> : <EventsList />}
      </div>
    </div>
  );
}
