import { useRef } from 'react';
import { MapCanvas } from './MapCanvas';
import { FloorStack } from './FloorStack';
import { LandmarkPicker } from './LandmarkPicker';
import { DetailPanel } from './DetailPanel';
import { RoomSearch } from './RoomSearch';
import { EdgeIndicators } from './EdgeIndicators';
import { useAppStore } from '../../store/useAppStore';

export function CampusMapView() {
  const selection = useAppStore((s) => s.mapSelection);
  // Edge arrows slide out from behind these panels instead of vanishing.
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const placesPanelRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  // `isolate` (isolation: isolate) confines Leaflet's internal panes/controls
  // and our z-[1000] overlays to this subtree's stacking context. Without it
  // those high z-indexes escape to the root and paint OVER app drawers/popovers
  // (eduroam, student popover — both z-50). See CampusMap layering notes.
  return (
    <div className="relative isolate w-full h-full">
      <MapCanvas />
      <EdgeIndicators occluders={[leftPanelRef, placesPanelRef, detailPanelRef]} />
      {/* Floor selector moved off the right edge (it overlapped the Místa panel)
          into the left column under the search. */}
      <div ref={leftPanelRef} className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2">
        <RoomSearch />
        <FloorStack />
      </div>
      <div ref={placesPanelRef} className="absolute top-3 right-3 z-[1000]"><LandmarkPicker /></div>
      {selection && (
        <div ref={detailPanelRef} className="absolute bottom-3 left-3 z-[1000] w-72"><DetailPanel /></div>
      )}
    </div>
  );
}
