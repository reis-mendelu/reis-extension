import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Arriving on the map from another screen collapses the events on the PHONE
 * and the iPad only — Dominik, 11 November 2026: "on the extension, keep the
 * events open since there the map is huge but on the phone there's little
 * space".
 *
 * Both halves are pinned. The phone tree collapses its sheet on the way into
 * the Mapa tab (setMobileTab), sizes an arriving card to its top
 * (useMapCardDetent, MapSheet), and the iPad's rail closes for a room
 * (MapRail). The extension's Akce/Místa panel opens expanded and only the
 * student's own toggle changes it — a later "let's do the same on desktop" is
 * exactly how that panel would start disappearing on the big screen.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('map arrival: phone collapses, extension keeps the events open', () => {
  it('the phone collapses its sheet on the way into the map', () => {
    expect(read('store/slices/createMobileUiSlice.ts')).toMatch(
      /arriving \? \{ mapSheetState: 'peek'/
    );
    expect(read('components/mobile/screens/map/MapSheet.tsx')).toContain('useMapCardDetent');
  });

  it('the iPad rail closes for a room', () => {
    expect(read('components/mobile/screens/map/MapRail.tsx')).toMatch(
      /showsRoom\) setOpen\(false\)/
    );
  });

  it('the extension panel starts expanded', () => {
    expect(read('store/slices/createMapSlice.ts')).toContain('mapPanelCollapsed: false');
  });

  it.each(['components/CampusMap/CampusMapView.tsx', 'components/CampusMap/MapSidePanel.tsx'])(
    '%s never collapses the panel on the student’s behalf',
    (file) => {
      const src = read(file);
      expect(src).not.toMatch(/mapPanelCollapsed:\s*true/);
      expect(src).not.toContain('setMapPanelCollapsed(true)');
    }
  );
});
