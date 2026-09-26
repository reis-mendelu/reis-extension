import { useAppStore } from '../../store/useAppStore';
import { hasBuildingModel } from '../../data/map/buildingModels';
import { hasWebGL2 } from './webgl';
import { targetFromSelection, type RoomTarget } from './roomTarget';
import { TILT_SPIKE } from './tilt/tiltFlag';

/**
 * The selected map room, when the map's panel should lead with it in 3D: a room
 * in a building with a model, on a device that can draw it, whose model has not
 * failed. The phone sheet and the tablet rail open for it the way they open for
 * an event; for anything else they behave exactly as before.
 */
export function useRoom3DTarget(): RoomTarget | null {
  const selection = useAppStore((s) => s.mapSelection);
  const target = targetFromSelection(selection);
  const failed = useAppStore((s) =>
    target ? s.buildingModels[target.buildingId] === 'failed' : false
  );
  // SPIKE (#462): the tilted map replaces the card on the phone and tablet. The
  // card would open the sheet over the floor column that holds the 3D switch.
  if (TILT_SPIKE) return null;
  if (!target || !hasBuildingModel(target.buildingId) || failed || !hasWebGL2()) return null;
  return target;
}
