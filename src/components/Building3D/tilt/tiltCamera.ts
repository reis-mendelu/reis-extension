import { metresPerDegree } from '../projection';

/**
 * The maths that lets a three.js camera stand in for the Leaflet map without a
 * visible jump: straight down, a camera at `flatDistance` shows the ground at
 * exactly Leaflet's scale, so the handover frame is the same picture — and only
 * then does it tilt. Frames are the model's local one: x east, z SOUTH, metres.
 */

/** The flat map's view at the moment it hands over. */
export interface MapView {
  center: [number, number]; // [lng, lat]
  zoom: number;
  width: number;
  height: number;
}

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

/** The tilted map's camera, as numbers: where it looks, from how far, how steep. */
export interface TiltCamera {
  target: [number, number, number];
  distance: number;
  pitch: number;
  /** Pixels to shift the view centre down (negative: up), so the target sits
   *  mid-way through the band the sheet and search bar leave visible. */
  offsetY: number;
}

export interface Band {
  /** Canvas pixels: the visible band between the top chrome and the sheet. */
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Frame a building of footprint `radius` and `height` (metres, local frame)
 * inside the visible band, at `pitch`. The whole bounding sphere fits the band
 * with `pad` to spare, whatever zoom the flat map was at.
 */
export function frameBuilding(
  radius: number,
  height: number,
  fovDeg: number,
  pitch: number,
  band: Band,
  pad = 1.12
): TiltCamera {
  const half = (fovDeg * Math.PI) / 360;
  const bandHalf = Math.atan(Math.tan(half) * ((band.bottom - band.top) / band.height));
  const widthHalf = Math.atan(Math.tan(half) * (band.width / band.height));
  const sphere = Math.hypot(radius, height / 2);
  return {
    target: [0, height / 2, 0],
    distance: (sphere / Math.sin(Math.min(bandHalf, widthHalf))) * pad,
    pitch,
    offsetY: (band.top + band.bottom) / 2 - band.height / 2,
  };
}

/** Zoom and pan limits that keep the building in view. */
export function clampTilt(cam: TiltCamera, framed: TiltCamera, radius: number): TiltCamera {
  const distance = Math.min(framed.distance * 1.5, Math.max(framed.distance * 0.4, cam.distance));
  const [x, y, z] = cam.target;
  const off = Math.hypot(x - framed.target[0], z - framed.target[2]);
  const k = off > radius * 1.5 ? (radius * 1.5) / off : 1;
  return {
    ...cam,
    distance,
    target: [
      framed.target[0] + (x - framed.target[0]) * k,
      y,
      framed.target[2] + (z - framed.target[2]) * k,
    ],
  };
}

/** Straight interpolation between two camera states (the handover animation). */
export function mixTilt(a: TiltCamera, b: TiltCamera, t: number): TiltCamera {
  const m = (p: number, q: number) => p + (q - p) * t;
  return {
    target: [m(a.target[0], b.target[0]), m(a.target[1], b.target[1]), m(a.target[2], b.target[2])],
    distance: m(a.distance, b.distance),
    pitch: m(a.pitch, b.pitch),
    offsetY: m(a.offsetY, b.offsetY),
  };
}

/** Keeps a label's gutter from the view's edges. */
export const LABEL_GUTTER = 16;

/**
 * Where to centre a label `labelWidth` wide that the scene placed at `x`, so it
 * stays whole inside a view `viewWidth` wide: a room on the building's edge put
 * its label half off screen. A label too wide to fit is centred.
 */
export function clampLabelX(x: number, labelWidth: number, viewWidth: number): number {
  const half = labelWidth / 2;
  const min = LABEL_GUTTER + half;
  const max = viewWidth - LABEL_GUTTER - half;
  if (min > max) return viewWidth / 2;
  return Math.min(max, Math.max(min, x));
}

/**
 * Where to anchor a pin `labelHeight` tall that hangs above `y`, so its top
 * stays clear of the view's top chrome (`top`, e.g. the search bar) and edge.
 */
export function clampLabelY(y: number, labelHeight: number, top: number): number {
  return Math.max(y, Math.max(LABEL_GUTTER, top) + labelHeight);
}
