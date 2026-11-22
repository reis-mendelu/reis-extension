/**
 * The isometric campus map: a deep-zoom pyramid of pre-rendered tiles (one folder
 * per season, written by izomapa outside this repo) shown in OpenSeadragon.
 *
 * It is a prototype and OFF unless a build or dev server names where the tiles
 * live with `VITE_ISO_MAP_URL` (e.g. `http://localhost:8793/tiles`). Nothing is
 * hosted anywhere yet, so that variable is the only way in.
 * src/test/guards/isoMapIsDormantAndOnBothTrees.test.ts holds that.
 * No feature counter yet, on purpose: counter labels are a database-enforced whitelist
 * (a migration that a release applies to prod) and this ships dark, so there is nothing
 * to count. The PR that sets a real host adds the label (docs/feature-counters.md).
 * Read per call, not at import, so a test can switch it with `vi.stubEnv`.
 */
export type IsoSeason = 'summer' | 'autumn' | 'winter' | 'spring' | 'lights';

/** What the data licences ask to be credited on the map itself. */
export const ISO_ATTRIBUTION = '© přispěvatelé OpenStreetMap, © ČÚZK';

// The pyramid `nastroje/dzi_small.py` wrote: 0,2 m per pixel, lossy WebP tiles of 512 px, no overlap.
// (dzi.py's 2048 px lossless tiles were ~1-1.5 MB each: 3 MB for a phone's first view.)
// OpenSeadragon's types take the DZI attributes as strings, as they are in the XML.
const SIZE = { Width: '12501', Height: '9559' };
const TILE_SIZE = '512';

/** Where the view opens: building Q, in OpenSeadragon viewport units (the image is 1 wide, so y is pixels / 12501). */
export const ISO_START = { x: 6308 / 12501, y: 6080 / 12501, zoom: 4 } as const;

const SEASONS: readonly IsoSeason[] = ['summer', 'autumn', 'winter', 'spring', 'lights'];

/** Summer, unless the dev server is asked for another with `?isoSeason=winter` (how the load times were measured). */
export function isoSeason(): IsoSeason {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return 'summer';
  const asked = new URLSearchParams(window.location.search).get('isoSeason');
  return SEASONS.find((x) => x === asked) ?? 'summer';
}

export function isoMapBase(): string | null {
  const raw = import.meta.env?.VITE_ISO_MAP_URL;
  if (typeof raw !== 'string') return null;
  const base = raw.trim().replace(/\/+$/, '');
  return base === '' ? null : base;
}

export function isoMapEnabled(): boolean {
  return isoMapBase() !== null;
}

/** OpenSeadragon's inline DZI description of one season's pyramid. */
export function isoDzi(base: string, season: IsoSeason) {
  return {
    Image: {
      xmlns: 'http://schemas.microsoft.com/deepzoom/2008',
      Url: `${base}/${season}/`,
      Format: 'webp',
      Overlap: '0',
      TileSize: TILE_SIZE,
      Size: { ...SIZE },
    },
  };
}
