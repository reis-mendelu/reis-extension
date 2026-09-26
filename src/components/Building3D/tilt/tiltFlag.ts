/**
 * SPIKE (#462, throwaway until the tilted map is judged): the map tilts into 3D
 * around building Q. Behind `?map3d=1`, or baked into a device test build — a
 * phone app has no URL bar.
 */
export const TILT_SPIKE =
  import.meta.env?.VITE_MAP3D === '1' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('map3d'));
