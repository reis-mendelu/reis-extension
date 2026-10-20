import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The "map needs one permission" banner is on the DESKTOP tree only, on purpose.
 *
 * It exists because a browser extension's tile requests reach OpenStreetMap
 * anonymous unless the browser lets reIS name itself (osmTilesAreIdentified),
 * and Firefox only does once the student grants the optional tile host. The
 * iOS and Android apps have no such permission: their WebView appends the
 * identity itself (capacitor.config.ts), and there is no permissions API there
 * to ask — the banner's own check reads "unsupported" and renders nothing.
 *
 * Pinned so a later reuse of the banner on MapScreen does not ship a dead
 * component to the phone, and so the desktop does not quietly lose it.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('OSM tile permission banner placement', () => {
  it('the extension map shows it', () => {
    expect(read('components/CampusMap/CampusMapView.tsx')).toContain('OsmTileAccessBanner');
  });

  it('the phone map does not', () => {
    expect(read('components/mobile/screens/MapScreen.tsx')).not.toContain('OsmTileAccessBanner');
  });
});
