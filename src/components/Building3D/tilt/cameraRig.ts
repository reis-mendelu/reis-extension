import { Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three';
import { cameraPosition, type TiltCamera } from './tiltCamera';

const NORTH_UP = 180; // the camera sits south of its target and never turns

/** Put a three.js camera where a TiltCamera says, north up, view centre shifted. */
export function applyTilt(
  camera: PerspectiveCamera,
  cam: TiltCamera,
  width: number,
  height: number
) {
  const [x, y, z] = cameraPosition(
    [cam.target[0], cam.target[2]],
    cam.distance,
    NORTH_UP,
    cam.pitch
  );
  camera.position.set(x, y + cam.target[1], z);
  camera.up.set(0, 1, 0);
  camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
  camera.aspect = width / height;
  // Shift the window over a same-size virtual frame so the target lands in the
  // middle of the visible band instead of behind the sheet.
  if (cam.offsetY) camera.setViewOffset(width, height, 0, -cam.offsetY, width, height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** Where a canvas pixel's ray meets the ground plane y = groundY, or null. */
export function groundAt(
  camera: PerspectiveCamera,
  px: number,
  py: number,
  width: number,
  height: number,
  groundY: number
): Vector3 | null {
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((px / width) * 2 - 1, -(py / height) * 2 + 1), camera);
  const hit = new Vector3();
  return ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -groundY), hit) ? hit : null;
}

/** Canvas pixel of a world point. */
export function screenOf(camera: PerspectiveCamera, p: Vector3, width: number, height: number) {
  const v = p.clone().project(camera);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, inFront: v.z < 1 };
}
