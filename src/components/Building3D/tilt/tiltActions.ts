import { useAppStore } from '../../../store/useAppStore';
import { getMapInstance } from '../../CampusMap/mapInstance';
import { hasBuildingModel } from '../../../data/map/buildingModels';
import { hasWebGL2 } from '../webgl';

// Leaflet's own +/- would zoom the hidden flat map, and the way back to 2D
// would then jump. Its controls go away while the map is tilted — all but the
// attribution, which draws over the tilted map and gains the model's credit
// (CC BY: the Brno 3D data is credited wherever it is drawn).
let credit: string | null = null;
function showLeafletControls(show: boolean, modelCredit: string | null = null) {
  const map = getMapInstance();
  if (!map) return;
  map
    .getContainer()
    .querySelectorAll('.leaflet-control:not(.leaflet-control-attribution)')
    .forEach((el) => el.classList.toggle('invisible', !show));
  if (credit) map.attributionControl?.removeAttribution(credit);
  credit = show ? null : modelCredit;
  if (credit) map.attributionControl?.addAttribution(credit);
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

/** Tilt the map into 3D around the building it is showing (the 3D button). */
export async function enterTilt() {
  const map = getMapInstance();
  const building = useAppStore.getState().activeBuildingId;
  if (!map || building === null || !hasBuildingModel(building) || !hasWebGL2()) return;
  await useAppStore.getState().loadMapBuilding(building);
  await useAppStore.getState().loadBuildingModel(building);
  if (!(await whenLoaded(building))) return;
  if (useAppStore.getState().mapTilt.phase !== 'flat') return;
  const c = map.getCenter();
  const size = map.getSize();
  const model = useAppStore.getState().buildingModels[building];
  showLeafletControls(false, model && model !== 'failed' ? model.meta.attribution : null);
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
