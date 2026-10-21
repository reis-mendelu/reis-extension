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

/**
 * Reports the current access, then every change made anywhere — the banner,
 * about:addons, Chrome's site-access menu. Started once, at boot, by main.tsx,
 * which forwards it to the store (createOsmTileAccessSlice).
 */
export function watchOsmTileAccess(onChange: (access: OsmTileAccess) => void): void {
  const api = permissionsApi();
  if (!api) return onChange('unsupported');
  const check = async () => {
    try {
      onChange((await api.contains({ origins: OSM_TILE_ORIGINS })) ? 'granted' : 'missing');
    } catch {
      onChange('unsupported');
    }
  };
  api.onAdded?.addListener(() => void check());
  api.onRemoved?.addListener(() => void check());
  void check();
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
      (ok) => ok === true,
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}
