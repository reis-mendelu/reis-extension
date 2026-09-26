import { useAppStore } from '../../../store/useAppStore';
import { getMapInstance } from '../../CampusMap/mapInstance';
import { hasBuildingModel } from '../../../data/map/buildingModels';
import { hasWebGL2 } from '../webgl';

// Leaflet's own +/- would zoom the hidden flat map, and the way back to 2D
// would then jump. Its controls go away while the map is tilted.
function showLeafletControls(show: boolean) {
  getMapInstance()
    ?.getContainer()
    .querySelector('.leaflet-control-container')
    ?.classList.toggle('invisible', !show);
}

/** Resolves once the building's model and floor plan are in the store (or never). */
function whenLoaded(building: number): Promise<boolean> {
  const ready = () => {
    const s = useAppStore.getState();
    const model = s.buildingModels[building];
    if (model === 'failed') return false;
    return model && s.roomsByBuilding[building] ? true : null;
  };
  return new Promise((resolve) => {
    const now = ready();
    if (now !== null) return resolve(now);
    const stop = useAppStore.subscribe(() => {
      const r = ready();
      if (r === null) return;
      stop();
      resolve(r);
    });
  });
}

/**
 * Tilt the map into 3D around the building it is showing. `load` is for the
 * button, an intent that may arrive before anything is loaded; the automatic
 * tilt on a room selection only waits for what the selection already loads.
 */
export async function enterTilt({ load = true }: { load?: boolean } = {}) {
  const map = getMapInstance();
  const building = useAppStore.getState().activeBuildingId;
  if (!map || building === null || !hasBuildingModel(building) || !hasWebGL2()) return;
  if (load) {
    await useAppStore.getState().loadMapBuilding(building);
    await useAppStore.getState().loadBuildingModel(building);
  }
  if (!(await whenLoaded(building))) return;
  if (useAppStore.getState().mapTilt.phase !== 'flat') return;
  const c = map.getCenter();
  const size = map.getSize();
  showLeafletControls(false);
  useAppStore.getState().setMapTilt({
    phase: '3d',
    view: { center: [c.lng, c.lat], zoom: map.getZoom(), width: size.x, height: size.y },
  });
}

/** Ask the tilted map to glide back to the flat one. */
export function leaveTilt() {
  const { mapTilt, setMapTilt } = useAppStore.getState();
  if (mapTilt.phase === '3d') setMapTilt({ ...mapTilt, phase: 'leaving' });
}

/** The glide back has finished: the flat map is on screen again. */
export function tiltClosed() {
  showLeafletControls(true);
  useAppStore.getState().setMapTilt({ phase: 'flat', view: null });
}
