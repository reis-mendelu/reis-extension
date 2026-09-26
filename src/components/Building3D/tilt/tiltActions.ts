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

/** Tilt the map into 3D around the building it is showing. */
export async function enterTilt() {
  const map = getMapInstance();
  const building = useAppStore.getState().activeBuildingId;
  if (!map || building === null || !hasBuildingModel(building) || !hasWebGL2()) return;
  // The intent loads what the 3D map needs, the way a hover loads the card's.
  await useAppStore.getState().loadMapBuilding(building);
  await useAppStore.getState().loadBuildingModel(building);
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
