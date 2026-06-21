import type L from 'leaflet';

// EdgeIndicators needs the live Leaflet map but must not trigger React
// re-renders on every pan/zoom. A module singleton + subscription keeps the
// map out of Zustand and out of the React tree (see plan §"Map-instance
// exposure"). It carries real logic, so it is not a re-export barrel.
let instance: L.Map | null = null;
const listeners = new Set<(m: L.Map | null) => void>();

export function setMapInstance(m: L.Map | null): void {
  instance = m;
  for (const cb of listeners) cb(m);
}

export function getMapInstance(): L.Map | null {
  return instance;
}

export function subscribeMapInstance(cb: (m: L.Map | null) => void): () => void {
  listeners.add(cb);
  cb(instance);
  return () => { listeners.delete(cb); };
}
