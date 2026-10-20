// Whether this browser lets reIS name itself on OpenStreetMap tile requests.
//
// In Firefox the tile host is an OPTIONAL permission (wxt.config.ts): required,
// it would hold every Firefox install's update behind a permission prompt.
// Until the student grants it, the background listener in
// src/entrypoints/background.ts sees no tile requests, they leave anonymous, and
// OSM may answer every one with its 403 "not following the tile usage policy"
// image. In Chrome the host is required, so this reads "missing" only when the
// student has withheld site access, which silences the header rule the same way.
//
// Detection is by feature: the iOS and Android apps and the dev webapp have no
// `browser.permissions`, read "unsupported", and never show the banner.

import { OSM_TILE_ORIGINS } from './osmTileIdentity';

export type OsmTileAccess = 'unsupported' | 'checking' | 'granted' | 'missing';

interface PermissionsApi {
  contains(p: { origins: string[] }): Promise<boolean>;
  request(p: { origins: string[] }): Promise<boolean>;
  onAdded?: { addListener(cb: () => void): void };
  onRemoved?: { addListener(cb: () => void): void };
}

function permissionsApi(): PermissionsApi | null {
  // Firefox has `browser`; Chrome only `chrome`, whose MV3 calls return promises.
  const g = globalThis as {
    browser?: { permissions?: PermissionsApi };
    chrome?: { permissions?: PermissionsApi };
  };
  return g.browser?.permissions ?? g.chrome?.permissions ?? null;
}

let state: OsmTileAccess = 'checking';
let started = false;
const listeners = new Set<() => void>();

function set(next: OsmTileAccess): void {
  if (next === state) return;
  state = next;
  for (const cb of listeners) cb();
}

async function check(): Promise<void> {
  const api = permissionsApi();
  if (!api) return set('unsupported');
  try {
    set((await api.contains({ origins: OSM_TILE_ORIGINS })) ? 'granted' : 'missing');
  } catch {
    set('unsupported');
  }
}

function start(): void {
  if (started) return;
  started = true;
  const api = permissionsApi();
  // The student can grant or revoke it in about:addons while the map is open.
  api?.onAdded?.addListener(() => void check());
  api?.onRemoved?.addListener(() => void check());
  void check();
}

export function getOsmTileAccess(): OsmTileAccess {
  return state;
}

/** For useSyncExternalStore. The first subscriber starts the check. */
export function subscribeOsmTileAccess(cb: () => void): () => void {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

/**
 * MUST be the first thing the click handler calls, before any await: Firefox
 * accepts `permissions.request` only while it is handling user input.
 */
export function requestOsmTileAccess(): Promise<boolean> {
  const api = permissionsApi();
  if (!api) return Promise.resolve(false);
  try {
    return api.request({ origins: OSM_TILE_ORIGINS }).then(
      (ok) => {
        void check();
        return ok === true;
      },
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}
