import type { PerspectiveCamera } from 'three';
import { applyTilt, groundAt } from './cameraRig';
import type { TiltCamera } from './tiltCamera';

export interface GestureHost {
  canvas: HTMLElement;
  camera: PerspectiveCamera;
  groundY: number;
  size: () => { width: number; height: number };
  get: () => TiltCamera;
  /** Store and draw a camera state; the host clamps it to its limits. */
  set: (next: TiltCamera) => TiltCamera;
  /** The largest distance the limits allow — zooming out past it leaves 3D. */
  maxDistance: () => number;
  onLeave: () => void;
}

// How far past the zoom-out limit a pinch or wheel must push before it counts
// as "take me back to the flat map".
const LEAVE_OVERSHOOT = 1.2;
const WHEEL_ZOOM = 0.0015;

/**
 * Map gestures for the tilted view, and nothing else: one finger (or the mouse)
 * pans with the content under the pointer staying under it, two fingers pinch
 * about their midpoint, the wheel zooms about the cursor. No rotation, ever —
 * the camera's pitch and heading are not the gestures' to change.
 */
export function attachTiltGestures(host: GestureHost): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let left = false;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = host.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ground = (x: number, y: number) => {
    const { width, height } = host.size();
    applyTilt(host.camera, host.get(), width, height);
    return groundAt(host.camera, x, y, width, height, host.groundY);
  };
  // Move the camera so the ground point under `from` ends up under `to`.
  const pan = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const a = ground(from.x, from.y);
    const b = ground(to.x, to.y);
    if (!a || !b) return;
    const c = host.get();
    host.set({ ...c, target: [c.target[0] + a.x - b.x, c.target[1], c.target[2] + a.z - b.z] });
  };
  const zoom = (at: { x: number; y: number }, factor: number) => {
    const wanted = host.get().distance * factor;
    if (factor > 1 && wanted > host.maxDistance() * LEAVE_OVERSHOOT) return leave();
    const before = ground(at.x, at.y);
    host.set({ ...host.get(), distance: wanted });
    const after = ground(at.x, at.y);
    if (!before || !after) return;
    const c = host.get();
    host.set({
      ...c,
      target: [c.target[0] + before.x - after.x, c.target[1], c.target[2] + before.z - after.z],
    });
  };
  const leave = () => {
    if (left) return;
    left = true;
    host.onLeave();
  };
  const span = (ps: { x: number; y: number }[]) =>
    Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
  const mid = (ps: { x: number; y: number }[]) => ({
    x: (ps[0]!.x + ps[1]!.x) / 2,
    y: (ps[0]!.y + ps[1]!.y) / 2,
  });

  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, local(e));
    host.canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const before = [...pointers.values()];
    const now = local(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 1) return pan(prev, now);
    if (pointers.size === 2) {
      const after = [...pointers.values()];
      zoom(mid(after), span(before) / Math.max(1, span(after)));
      pan(mid(before), mid(after));
    }
  };
  const up = (e: PointerEvent) => pointers.delete(e.pointerId);
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom(local(e), Math.exp(e.deltaY * WHEEL_ZOOM));
  };

  host.canvas.addEventListener('pointerdown', down);
  host.canvas.addEventListener('pointermove', move);
  host.canvas.addEventListener('pointerup', up);
  host.canvas.addEventListener('pointercancel', up);
  host.canvas.addEventListener('wheel', wheel, { passive: false });
  return () => {
    host.canvas.removeEventListener('pointerdown', down);
    host.canvas.removeEventListener('pointermove', move);
    host.canvas.removeEventListener('pointerup', up);
    host.canvas.removeEventListener('pointercancel', up);
    host.canvas.removeEventListener('wheel', wheel);
  };
}
