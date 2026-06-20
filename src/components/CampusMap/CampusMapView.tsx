import { MapCanvas } from './MapCanvas';
import { BuildingBar } from './BuildingBar';
import { FloorStack } from './FloorStack';
import { DetailPanel } from './DetailPanel';
import { RoomSearch } from './RoomSearch';
import { useAppStore } from '../../store/useAppStore';

export function CampusMapView() {
  const selection = useAppStore((s) => s.mapSelection);
  return (
    <div className="relative w-full h-full">
      <MapCanvas />
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <BuildingBar />
        <RoomSearch />
      </div>
      <div className="absolute top-3 right-3 z-[1000]"><FloorStack /></div>
      {selection && (
        <div className="absolute bottom-3 left-3 z-[1000] w-72"><DetailPanel /></div>
      )}
    </div>
  );
}
