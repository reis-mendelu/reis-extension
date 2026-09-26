/**
 * Drag to spin the building card; let go and it springs back to the default
 * view, so the card always comes to rest facing the way students know Q.
 * The maths is pure and tested; `attachOrbit` only wires pointer events to it.
 */
export interface View {
  /** Compass bearing from the building to the camera, degrees. */
  azimuth: number;
  /** Camera elevation above the horizon, degrees. */
  pitch: number;
}

export const PITCH_MIN = 12;
export const PITCH_MAX = 70;
const DEG_PER_PX = 0.35;
const SPRING_RATE = 5; // 1/s — settles in about a second
const IDLE_BEFORE_SPRING_MS = 1400;

const wrap = (deg: number) => ((deg % 360) + 360) % 360;
export const clampPitch = (p: number) => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));

export function dragBy(view: View, dx: number, dy: number): View {
  return {
    azimuth: wrap(view.azimuth - dx * DEG_PER_PX),
    pitch: clampPitch(view.pitch - dy * DEG_PER_PX),
  };
}

export function springToward(view: View, home: View, dt: number): View {
  const k = 1 - Math.exp(-dt * SPRING_RATE);
  const dAz = ((home.azimuth - view.azimuth + 540) % 360) - 180; // the short way round
  const dPitch = home.pitch - view.pitch;
  const settled = Math.abs(dAz) < 0.2 && Math.abs(dPitch) < 0.2;
  if (settled) return { ...home };
  return { azimuth: wrap(view.azimuth + dAz * k), pitch: view.pitch + dPitch * k };
}

/**
 * Wire pointer drags on `el` to the view. `onChange` is the only render
 * trigger: nothing draws unless a finger moves or the spring is running.
 */
export function attachOrbit(el: HTMLElement, home: View, onChange: (view: View) => void) {
  let view = { ...home };
  let last: { x: number; y: number } | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;

  const stopSpring = () => {
    cancelAnimationFrame(frame);
    clearTimeout(idle);
  };
  const spring = () => {
    let prev = performance.now();
    const step = (now: number) => {
      view = springToward(view, home, Math.min(0.05, (now - prev) / 1000));
      prev = now;
      onChange(view);
      if (view.azimuth !== home.azimuth || view.pitch !== home.pitch)
        frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  const down = (e: PointerEvent) => {
    stopSpring();
    last = { x: e.clientX, y: e.clientY };
    el.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!last) return;
    view = dragBy(view, e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
    onChange(view);
  };
  const up = () => {
    if (!last) return;
    last = null;
    idle = setTimeout(spring, IDLE_BEFORE_SPRING_MS);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    stopSpring();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}
