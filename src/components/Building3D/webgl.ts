let cached: boolean | null = null;

/**
 * Whether this device can draw the 3D card (three.js needs WebGL2). Probed once
 * per session, and the probe's context is released straight away: iOS caps live
 * WebGL contexts per page, and a leaked probe would count against the card.
 */
export function hasWebGL2(): boolean {
  if (cached !== null) return cached;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    cached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * A device can advertise WebGL2 and still fail to build a renderer (a lost or
 * blocklisted context — seen in an embedded browser that returned null shader
 * precision). After one such failure, every card falls back for the session.
 */
export function markWebGL2Unavailable(): void {
  cached = false;
}

/** Tests only: forget the probe result. */
export function resetWebGL2Probe(value: boolean | null = null): void {
  cached = value;
}
