export interface Box { w: number; h: number; pad: number; }
export interface Extent { minLat: number; maxLat: number; minLng: number; maxLng: number; }

export function projectRing(ring: [number, number][], box: Box, ext: Extent): string {
  const sx = (box.w - 2 * box.pad) / (ext.maxLng - ext.minLng || 1);
  const sy = (box.h - 2 * box.pad) / (ext.maxLat - ext.minLat || 1);
  return ring.map(([lat, lng]) => {
    const x = box.pad + (lng - ext.minLng) * sx;
    const y = box.h - box.pad - (lat - ext.minLat) * sy; // flip Y for screen coords
    return `${Math.round(x)},${Math.round(y)}`;
  }).join(' ');
}
