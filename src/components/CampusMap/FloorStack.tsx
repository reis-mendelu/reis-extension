import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';
import { TiltButton } from '../Building3D/tilt/TiltButton';

const META = buildingsJson as BuildingsMeta;

export function FloorStack() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const setMapFloor = useAppStore((s) => s.setMapFloor);
  const tilted = useAppStore((s) => s.mapTilt.phase !== 'flat');
  if (activeBuildingId === null) return null;
  const b = META.buildings.find((x) => x.id === activeBuildingId);
  if (!b) return null;
  return (
    <div className="flex flex-col gap-1 p-1 bg-base-200 rounded-lg">
      <TiltButton />
      {/* While tilted the floor is the room's own, shown in 3D; the list would
          only offer floors the tilted view does not draw. */}
      {!tilted &&
        b.floors.map((f) => (
          <button
            key={f.id}
            className={`btn btn-xs ${activeFloorId === f.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMapFloor(f.id)}
          >
            {f.name ?? f.level}
          </button>
        ))}
    </div>
  );
}
