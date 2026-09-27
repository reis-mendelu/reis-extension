import { Vector3, type PerspectiveCamera } from 'three';
import { screenOf } from './cameraRig';
import { placeLabels, type LabelAnchor, type ScreenBox } from './roomLabels';

/** A room label as the scene places it this frame: its text at a screen point. */
export interface OnScreenLabel {
  text: string;
  x: number;
  y: number;
}

/**
 * The tilted floor's room names, as DOM text over the canvas — like the pin,
 * positioned by the scene every frame without a React render. In the DOM they
 * read as the flat plan's labels do (same size, weight and ink) and the UI
 * checks can measure them; the ones that would collide are left out.
 */
export function createLabelLayer(host: HTMLElement) {
  const spans: HTMLSpanElement[] = [];
  const hideAll = () => spans.forEach((s) => s.classList.add('hidden'));
  return (labels: OnScreenLabel[] | null, blocked: ScreenBox[]) => {
    if (!labels) return hideAll();
    while (spans.length < labels.length) {
      const s = document.createElement('span');
      s.className =
        'pointer-events-none absolute left-0 top-0 hidden whitespace-nowrap text-[10px] font-semibold text-gray-800';
      s.dataset.testid = 'tilt-room-label';
      host.appendChild(s);
      spans.push(s);
    }
    const boxes = labels.map((l, i) => {
      const s = spans[i]!;
      if (s.textContent !== l.text) s.textContent = l.text;
      // Measured while shown: a hidden span has no width.
      s.classList.remove('hidden');
      return { x: l.x, y: l.y, w: s.offsetWidth, h: s.offsetHeight };
    });
    const keep = new Set(placeLabels(boxes, host.clientWidth, host.clientHeight, blocked));
    spans.forEach((s, i) => {
      const b = boxes[i];
      if (!b || !keep.has(i)) return void s.classList.add('hidden');
      s.style.transform = `translate(${b.x - b.w / 2}px, ${b.y - b.h / 2}px)`;
    });
  };
}

const scratch = new Vector3();

/** Where the floor's labels fall on screen under `camera`; the ones behind it are dropped. */
export function labelsOnScreen(
  camera: PerspectiveCamera,
  labels: LabelAnchor[],
  view: { width: number; height: number }
): OnScreenLabel[] {
  return labels.flatMap((l) => {
    const p = screenOf(camera, scratch.set(l.x, l.y, l.z), view.width, view.height);
    return p.inFront ? [{ text: l.text, x: p.x, y: p.y }] : [];
  });
}

/** The screen box around a set of points (the lit room's top), or null when behind the camera. */
export function boxOnScreen(
  camera: PerspectiveCamera,
  points: Vector3[],
  view: { width: number; height: number }
): ScreenBox | null {
  const on = points.map((p) => screenOf(camera, p, view.width, view.height));
  if (on.length === 0 || on.some((p) => !p.inFront)) return null;
  const xs = on.map((p) => p.x);
  const ys = on.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
