import { metresPerDegree } from '../projection';

/**
 * The maths that lets a three.js camera stand in for the Leaflet map without a
 * visible jump: straight down, a camera at `flatDistance` shows the ground at
 * exactly Leaflet's scale, so the handover frame is the same picture — and only
 * then does it tilt. Frames are the model's local one: x east, z SOUTH, metres.
 */

/** "Straight down", short of 90° so the camera's up vector stays defined. */
export const FLAT_PITCH = 89.9;

/**
 * Local-frame metres under one CSS pixel of the Leaflet map at `zoom`.
 * Web Mercator puts 256·2^zoom pixels round the world in longitude, and
 * stretches latitude by 1/cos φ — so a pixel is `deg` of longitude and
 * `deg·cos φ` of latitude.
 */
export function localMetresPerPixel(latDeg: number, zoom: number): { x: number; y: number } {
  const deg = 360 / (256 * 2 ** zoom);
  const m = metresPerDegree(latDeg);
  return { x: deg * m.lng, y: deg * Math.cos((latDeg * Math.PI) / 180) * m.lat };
}

/** How high a straight-down camera sits to show `heightPx` pixels of ground. */
export function flatDistance(heightPx: number, mppY: number, fovDeg: number): number {
  return (heightPx * mppY) / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

/**
 * Camera position `distance` from a ground target, on compass bearing
 * `azimuthDeg` (target → camera, clockwise from north) and `pitchDeg` above the
 * horizon.
 */
export function cameraPosition(
  target: readonly [number, number],
  distance: number,
  azimuthDeg: number,
  pitchDeg: number
): [number, number, number] {
  const [a, p] = [(azimuthDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180];
  return [
    target[0] + distance * Math.cos(p) * Math.sin(a),
    distance * Math.sin(p),
    target[1] - distance * Math.cos(p) * Math.cos(a),
  ];
}
