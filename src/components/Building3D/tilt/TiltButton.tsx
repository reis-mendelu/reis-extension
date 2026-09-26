import { useAppStore } from '../../../store/useAppStore';
import { hasBuildingModel } from '../../../data/map/buildingModels';
import { TILT_SPIKE } from './tiltFlag';
import { enterTilt, leaveTilt } from './tiltActions';

/**
 * The 3D/2D switch, at the top of the floor column: it exists exactly when a
 * building with a model is open, and the column already has a place on both
 * trees that nothing else collides with — unlike a free-floating button, which
 * sat on the search results.
 */
export function TiltButton() {
  const building = useAppStore((s) => s.activeBuildingId);
  const phase = useAppStore((s) => s.mapTilt.phase);
  if (!TILT_SPIKE || building === null || !hasBuildingModel(building)) return null;
  const flat = phase === 'flat';
  return (
    <button
      type="button"
      onClick={flat ? () => void enterTilt() : leaveTilt}
      aria-pressed={!flat}
      className={`btn btn-xs ${flat ? 'btn-ghost' : 'btn-primary'}`}
    >
      {flat ? '3D' : '2D'}
    </button>
  );
}
