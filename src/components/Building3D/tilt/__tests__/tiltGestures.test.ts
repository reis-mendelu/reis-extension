import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { attachTiltGestures, type GestureHost } from '../tiltGestures';
import { applyTilt, groundAt, screenOf } from '../cameraRig';
import { clampTilt, frameBuilding, type TiltCamera } from '../tiltCamera';

const [W, H, GROUND] = [390, 844, 4.57];
const framed = frameBuilding(67, 28.75, 40, 50, { top: 110, bottom: 690, width: W, height: H });

function setup() {
  const canvas = document.createElement('div');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H }) as DOMRect;
  document.body.appendChild(canvas);
  const camera = new PerspectiveCamera(40, W / H, 1, 5000);
  let state: TiltCamera = { ...framed };
  const onLeave = vi.fn();
  const host: GestureHost = {
    canvas,
    camera,
    groundY: GROUND,
    size: () => ({ width: W, height: H }),
    get: () => state,
    set: (next) => (state = clampTilt(next, framed, 67)),
    maxDistance: () => framed.distance * 1.5,
    onLeave,
  };
  const detach = attachTiltGestures(host);
  // happy-dom's WheelEvent drops clientX/clientY from its init dict; define them.
  const wheel = (deltaY: number, x: number, y: number) => {
    const e = new WheelEvent('wheel', { deltaY, cancelable: true });
    Object.defineProperties(e, { clientX: { value: x }, clientY: { value: y } });
    canvas.dispatchEvent(e);
  };
  const at = (type: string, x: number, y: number, id = 1) =>
    canvas.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, bubbles: true })
    );
  const project = (x: number, y: number) => {
    applyTilt(camera, state, W, H);
    return groundAt(camera, x, y, W, H, GROUND)!;
  };
  const screen = (p: ReturnType<typeof project>) => {
    applyTilt(camera, state, W, H);
    return screenOf(camera, p, W, H);
  };
  return { canvas, at, wheel, project, screen, get: () => state, onLeave, detach };
}

describe('tilted map gestures', () => {
  it('pans with the finger: the ground under it at the start is still under it at the end', () => {
    const g = setup();
    const p = g.project(150, 420);
    g.at('pointerdown', 150, 420);
    for (let i = 1; i <= 10; i++) g.at('pointermove', 150 + i * 6, 420 + i * 5);
    g.at('pointerup', 210, 470);
    const s = g.screen(p);
    expect(s.x).toBeCloseTo(210, 0);
    expect(s.y).toBeCloseTo(470, 0);
  });

  it('never rotates or changes the tilt, whatever the gesture', () => {
    const g = setup();
    g.at('pointerdown', 100, 300);
    g.at('pointermove', 300, 600);
    g.at('pointerup', 300, 600);
    g.wheel(-400, 200, 400);
    expect(g.get().pitch).toBe(framed.pitch);
  });

  it('pinches about the fingers: spreading them zooms in', () => {
    const g = setup();
    const before = g.get().distance;
    g.at('pointerdown', 150, 400, 1);
    g.at('pointerdown', 250, 400, 2);
    g.at('pointermove', 100, 400, 1);
    g.at('pointermove', 300, 400, 2);
    expect(g.get().distance).toBeLessThan(before);
  });

  it('zooms with the wheel about the cursor, keeping the point under it in place', () => {
    const g = setup();
    const p = g.project(120, 380);
    g.wheel(-200, 120, 380);
    const s = g.screen(p);
    expect(s.x).toBeCloseTo(120, 0);
    expect(s.y).toBeCloseTo(380, 0);
  });

  it('flattens back to the map when zooming out well past the limit', () => {
    const g = setup();
    for (let i = 0; i < 20; i++) g.wheel(300, 200, 400);
    expect(g.onLeave).toHaveBeenCalledTimes(1);
  });
});
