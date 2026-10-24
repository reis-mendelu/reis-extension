import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The "map needs one permission" banner is on BOTH map trees.
 *
 * It is an extension feature (Firefox's optional OSM tile host), but the
 * extension renders the phone tree too: Firefox for Android, or any narrow
 * touch window. A phone-tree map without it left those students with blocked
 * tiles and no way to grant access. The apps are kept clear by the state, not
 * by the tree: they have no permissions API, so the watcher reports
 * `unsupported` there and the banner renders nothing.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('OSM tile permission banner placement', () => {
  it.each(['components/CampusMap/CampusMapView.tsx', 'components/mobile/screens/MapScreen.tsx'])(
    '%s shows it',
    (file) => {
      expect(read(file)).toContain('<OsmTileAccessBanner');
    }
  );

  it('renders only when the extension has reported the permission missing', () => {
    expect(read('components/CampusMap/OsmTileAccessBanner.tsx')).toContain(
      "if (access !== 'missing') return null;"
    );
    expect(read('entrypoints/main/main.tsx')).toContain('watchOsmTileAccess(');
    expect(read('utils/osmTileAccess.ts')).toContain("if (!api) return onChange('unsupported');");
  });
});
