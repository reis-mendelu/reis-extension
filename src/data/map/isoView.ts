import { ISO_START } from './isoMap';

/**
 * Where things are on the isometric picture, and how far it may be zoomed.
 *
 * The picture is one orthographic render: north up, camera tilted 45°, 0,2 m per
 * pixel, centred on the campus. So a place's pixel is plain geometry: east is
 * x, and north and height both push it up the page by cos 45°. The constants
 * are the render's own (its centre, its top-left corner in metres), checked
 * against building Q in isoView.test.ts.
 */
export const IMG = { w: 11535, h: 8517 };
const GEO = {
  lon0: 16.6141,
  lat0: 49.21265,
  // The render's top-left corner in metres, moved to where the cropped picture starts (484, 658 px of the original).
  x0: -1250.14559672906 + 484 * 0.2,
  y1: 990.7958500237901 - 658 * 0.2,
  mpp: 0.2,
  /** Campus ground above the render's zero level, metres. A 10 m error is 35 px, invisible at these zooms. */
  ground: 17,
};

/**
 * A place in the picture's own pixels (not clamped to it), `heightM` metres above the ground:
 * height pushes a place up the page exactly as far north does, by cos 45°.
 */
export function isoPixel(lat: number, lng: number, heightM = 0): { px: number; py: number } {
  const east = (lng - GEO.lon0) * Math.cos((GEO.lat0 * Math.PI) / 180) * 111320;
  const north = (lat - GEO.lat0) * 110574;
  return {
    px: (east - GEO.x0) / GEO.mpp,
    py: (GEO.y1 - Math.SQRT1_2 * (north + GEO.ground + heightM)) / GEO.mpp,
  };
}

/** A place in OpenSeadragon viewport units (the picture is 1 wide, so y is pixels / 11535), or null off the picture. */
export function isoPointFromLatLng(lat: number, lng: number): { x: number; y: number } | null {
  const { px, py } = isoPixel(lat, lng);
  if (px < 0 || px > IMG.w || py < 0 || py > IMG.h) return null;
  return { x: px / IMG.w, y: py / IMG.w };
}

/** The widest stretch of ground you may see at once: about a kilometre, i.e. the campus and its neighbourhood. */
const MAX_VISIBLE_PX = 6000;

/**
 * The furthest out you may zoom. Two limits, the tighter wins: the picture must
 * still cover the whole screen (no empty space to get lost in; on a portrait phone
 * its height decides), and no more than about a kilometre of ground is shown, so
 * this stays a close look at the campus rather than a small map of the city.
 */
export function isoMinZoom(width: number, height: number): number {
  const cover = Math.max(1, height / width / (IMG.h / IMG.w));
  return Math.max(cover, IMG.w / MAX_VISIBLE_PX);
}

/** The 2D map's camera, as Leaflet reports it. */
export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

// Capped at the campus-wide scale: a sharper opening zoom asks for several times the tiles (a phone's
// first view went from 0.7 to 2.6 MB), and the first open is what has to be quick.
/** Whether the picture has anything to show for where the 2D map is looking (no 2D map: yes, it opens on the campus). */
export function isoCoversView(map: MapView | null): boolean {
  return !map || isoPointFromLatLng(map.lat, map.lng) !== null;
}

const OPEN_ZOOM = { min: 3, max: ISO_START.zoom };

/**
 * Where the picture opens. Following the 2D map keeps the student's place: the
 * building they were looking at is still in the middle, at about the same scale
 * (the east-west scale is exact; the tilt only stretches north-south). With no
 * 2D map, or one looking off the picture, it opens on the campus. The scale is
 * kept in a range, so a floor plan's very close zoom does not open on blur or a slow download.
 */
export function isoOpeningView(map: MapView | null, containerWidth: number) {
  const at = map ? isoPointFromLatLng(map.lat, map.lng) : null;
  if (!map || !at) return ISO_START;
  const metresPerCssPx = (156543.03392 * Math.cos((map.lat * Math.PI) / 180)) / 2 ** map.zoom;
  const same = (GEO.mpp * IMG.w) / (metresPerCssPx * Math.max(1, containerWidth));
  const zoom = Math.min(OPEN_ZOOM.max, Math.max(OPEN_ZOOM.min, same));
  return { x: at.x, y: at.y, zoom };
}
