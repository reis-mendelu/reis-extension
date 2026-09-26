import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { BufferGeometry, Object3D } from 'three';

/**
 * Lines with a real width. WebGL's own lines are one DEVICE pixel — half a CSS
 * pixel on a phone — where Leaflet draws a building outline 2 CSS px wide and a
 * room 1 px: the handover frame lost its strokes, and on a phone the glass edges
 * all but vanished. `width` is in CSS pixels; the resolution is set per scene.
 */
export function fatMaterial(color: string, width: number, opacity = 1): LineMaterial {
  return new LineMaterial({
    color,
    // In CSS pixels: the resolution set below already carries the pixel ratio.
    linewidth: width,
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
  });
}

/** Segments (pairs of points, as LineSegments takes them) drawn with a width. */
export function fatSegments(geometry: BufferGeometry, material: LineMaterial): LineSegments2 {
  const g = new LineSegmentsGeometry();
  const pos = geometry.getAttribute('position');
  g.setPositions(Array.from(pos.array as ArrayLike<number>).slice(0, pos.count * 3));
  return new LineSegments2(g, material);
}

/** Tell every fat line in a scene the canvas size, in CSS pixels. */
export function sizeFatLines(root: Object3D, width: number, height: number) {
  root.traverse((o) => {
    const m = (o as { material?: unknown }).material;
    if (m instanceof LineMaterial) m.resolution.set(width, height);
  });
}

export { LineMaterial };
