import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

export function BuildingBar() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const setMapBuilding = useAppStore((s) => s.setMapBuilding);
  const exitToCampus = useAppStore((s) => s.exitToCampus);
  return (
    <div className="flex items-center gap-1 p-1 bg-base-200 rounded-lg">
      <button className={`btn btn-sm ${activeBuildingId === null ? 'btn-primary' : 'btn-ghost'}`}
        onClick={exitToCampus}>⌂</button>
      {META.buildings.map((b) => (
        <button key={b.id}
          className={`btn btn-sm ${activeBuildingId === b.id ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMapBuilding(b.id)}>{b.name}</button>
      ))}
    </div>
  );
}
